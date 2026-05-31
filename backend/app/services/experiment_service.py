from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.models.experiment import Experiment, ExperimentRun
from app.models.learning import AgentEvaluation, AgentFeedback
from app.models.observatory import AgentExecution, AgentExecutionEvent, LearningEvent, TokenUsage
from app.models.run import Run, TraceEvent
from app.models.workflow import Workflow
from app.runtime.runner_factory import create_runner
from app.schemas.experiments import ExperimentCreate


def list_experiments(db: Session, include_archived: bool = False) -> list[Experiment]:
    statement = select(Experiment)
    if not include_archived:
        statement = statement.where(Experiment.archived_at.is_(None))
    return list(db.scalars(statement.order_by(Experiment.id)).all())


def get_experiment(db: Session, experiment_id: int) -> Experiment:
    return db.get(Experiment, experiment_id)


def list_experiment_runs(db: Session, experiment_id: int) -> list[ExperimentRun]:
    statement = select(ExperimentRun).where(ExperimentRun.experiment_id == experiment_id).order_by(ExperimentRun.id.desc())
    return list(db.scalars(statement).all())


def create_experiment(db: Session, payload: ExperimentCreate) -> Experiment:
    experiment = Experiment(**payload.model_dump())
    db.add(experiment)
    db.commit()
    db.refresh(experiment)
    return experiment


def archive_experiment(db: Session, experiment: Experiment) -> Experiment:
    if experiment.archived_at is None:
        experiment.archived_at = datetime.utcnow()
    db.commit()
    db.refresh(experiment)
    return experiment


def activate_experiment(db: Session, experiment: Experiment) -> Experiment:
    experiment.archived_at = None
    db.commit()
    db.refresh(experiment)
    return experiment


def delete_experiment(db: Session, experiment: Experiment, force: bool = False) -> dict:
    experiment_runs = db.scalars(
        select(ExperimentRun).where(ExperimentRun.experiment_id == experiment.id)
    ).all()

    if experiment_runs:
        if force:
            all_run_ids = sorted({rid for er in experiment_runs for rid in (er.run_ids or [])})
            db.execute(delete(ExperimentRun).where(ExperimentRun.experiment_id == experiment.id))
            db.flush()

            for run_id in all_run_ids:
                run = db.get(Run, run_id)
                if run is None:
                    continue

                has_feedback = db.scalar(
                    select(AgentFeedback.id).where(AgentFeedback.run_id == run_id).limit(1)
                ) is not None
                has_evaluations = db.scalar(
                    select(AgentEvaluation.id).where(AgentEvaluation.run_id == run_id).limit(1)
                ) is not None
                has_learning = db.scalar(
                    select(LearningEvent.id).where(LearningEvent.run_id == run_id).limit(1)
                ) is not None

                if has_feedback or has_evaluations or has_learning:
                    if run.status != "archived":
                        run.status = "archived"
                        run.archived_at = datetime.utcnow()
                else:
                    db.execute(delete(TokenUsage).where(TokenUsage.run_id == run_id))
                    db.execute(delete(AgentExecutionEvent).where(AgentExecutionEvent.run_id == run_id))
                    db.execute(delete(AgentExecution).where(AgentExecution.run_id == run_id))
                    db.execute(delete(TraceEvent).where(TraceEvent.run_id == run_id))
                    db.delete(run)
        else:
            run_ids = sorted({rid for er in experiment_runs for rid in (er.run_ids or [])})
            return {
                "deleted": False,
                "blocked": True,
                "experiment_id": experiment.id,
                "experiment_name": experiment.name,
                "experiment_run_count": len(experiment_runs),
                "run_ids": run_ids,
                "message": (
                    f"Cannot safely delete experiment '{experiment.name}' because it has "
                    f"{len(experiment_runs)} experiment run(s) with underlying workflow runs "
                    f"(ids {run_ids}). Force-delete will remove the experiment, its run links, "
                    "and any underlying workflow runs that have no associated feedback, "
                    "evaluations, or learning events. Runs with learning data will be archived instead."
                ),
            }

    db.delete(experiment)
    db.commit()
    return {"deleted": True, "blocked": False, "experiment_id": experiment.id}


def run_experiment(db: Session, experiment: Experiment) -> ExperimentRun:
    exp_type = (experiment.evaluation_config or {}).get("experiment_type", "")
    if exp_type == "soul_behavior_comparison":
        return _run_soul_comparison(db, experiment)
    return _run_standard_experiment(db, experiment)


def _run_standard_experiment(db: Session, experiment: Experiment) -> ExperimentRun:
    run_ids: list[int] = []
    agent_results = []

    for agent_id in experiment.agent_ids:
        agent = db.get(Agent, agent_id)
        if agent is None or not agent.is_active:
            raise ValueError(f"Experiment references missing or inactive agent {agent_id}.")

        workflow = Workflow(
            name=f"Experiment {experiment.id}: {agent.name}",
            description=f"Single-agent comparison run for experiment {experiment.id}.",
            workflow_type="sequential",
            graph_config={"agent_sequence": [agent.id], "experiment_id": experiment.id},
        )
        db.add(workflow)
        db.commit()
        db.refresh(workflow)

        run = create_runner(db, workflow).run(workflow, experiment.task_prompt)
        run_ids.append(run.id)
        agent_results.append(
            {
                "agent_id": agent.id,
                "agent_name": agent.name,
                "run_id": run.id,
                "trace_url": f"/runs/{run.id}",
                "output": (run.output or {}).get("final_output", ""),
            }
        )

    experiment_run = ExperimentRun(
        experiment_id=experiment.id,
        run_ids=run_ids,
        comparison_result={
            "experiment_type": "standard",
            "experiment_id": experiment.id,
            "task_prompt": experiment.task_prompt,
            "agent_results": agent_results,
            "evaluation_config": experiment.evaluation_config,
        },
    )
    db.add(experiment_run)
    db.commit()
    db.refresh(experiment_run)
    return experiment_run


def _run_soul_comparison(db: Session, experiment: Experiment) -> ExperimentRun:
    """Run the same supervisor workflow once per soul variant, comparing coordination behavior."""
    from app.models.soul import Soul
    from app.models.workflow import Workflow as WorkflowModel
    from app.services import collaboration_service, observatory_service

    config = experiment.evaluation_config or {}
    workflow_id = config["workflow_id"]
    supervisor_agent_id = config["supervisor_agent_id"]
    soul_ids: list[int] = config["soul_ids"]

    workflow = db.get(WorkflowModel, workflow_id)
    if workflow is None:
        raise ValueError(f"Workflow {workflow_id} not found.")

    supervisor = db.get(Agent, supervisor_agent_id)
    if supervisor is None or not supervisor.is_active:
        raise ValueError(f"Supervisor agent {supervisor_agent_id} not found or inactive.")

    original_soul_id = supervisor.soul_id
    run_ids: list[int] = []
    variants: list[dict] = []

    for soul_id in soul_ids:
        soul = db.get(Soul, soul_id)
        if soul is None:
            raise ValueError(f"Soul {soul_id} not found.")

        # Temporarily swap supervisor soul
        supervisor.soul_id = soul_id
        db.commit()
        db.refresh(supervisor)

        try:
            run = create_runner(db, workflow).run(workflow, experiment.task_prompt)
        finally:
            # Restore original soul regardless of success/failure
            supervisor.soul_id = original_soul_id
            db.commit()
            db.refresh(supervisor)

        run_ids.append(run.id)
        variant_data = _collect_variant_metrics(db, run, soul)
        variants.append(variant_data)

    experiment_run = ExperimentRun(
        experiment_id=experiment.id,
        run_ids=run_ids,
        comparison_result={
            "experiment_type": "soul_behavior_comparison",
            "experiment_id": experiment.id,
            "workflow_id": workflow_id,
            "supervisor_agent_id": supervisor_agent_id,
            "supervisor_agent_name": supervisor.name,
            "task_prompt": experiment.task_prompt,
            "variants": variants,
        },
    )
    db.add(experiment_run)
    db.commit()
    db.refresh(experiment_run)
    return experiment_run


def _collect_variant_metrics(db: Session, run, soul) -> dict:
    """Collect comparison metrics for one soul variant from run observatory data."""
    from app.services import collaboration_service, observatory_service

    graph = collaboration_service.build_collaboration_graph(db, run.id)
    summary = graph.get("chain_summary", {})
    executions = observatory_service.list_executions_for_run(db, run.id)
    tokens = observatory_service.token_usage_summary(db, run.id)

    delegation_edges = [e for e in graph.get("edges", []) if e.get("type") == "delegation"]
    worker_order = [e["to_agent_id"] for e in delegation_edges]
    unique_workers = len(set(worker_order))
    avg_instruction_len = None
    if delegation_edges:
        lengths = [len(e.get("full_instruction", "") or e.get("instruction", "")) for e in delegation_edges]
        avg_instruction_len = sum(lengths) / len(lengths)

    final_output = (run.output or {}).get("final_output", "")
    return {
        "soul_id": soul.id,
        "soul_name": soul.name,
        "run_id": run.id,
        "status": run.status,
        "delegation_count": summary.get("delegation_count", 0),
        "worker_order": worker_order,
        "unique_workers_used": unique_workers,
        "supervisor_iterations": summary.get("supervisor_iterations", 0),
        "final_decision": summary.get("final_decision"),
        "total_tokens": tokens.get("total_tokens", 0),
        "estimated_cost": tokens.get("estimated_cost", 0.0),
        "avg_instruction_length": avg_instruction_len,
        "final_output_preview": final_output[:300] if final_output else "",
        "collaboration_graph_url": f"/runs/{run.id}/collaboration-graph",
    }
