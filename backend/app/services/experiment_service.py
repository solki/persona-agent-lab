from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.models.experiment import Experiment, ExperimentRun
from app.models.workflow import Workflow
from app.runtime.workflow_runner import WorkflowRunner
from app.schemas.experiments import ExperimentCreate


def list_experiments(db: Session, include_archived: bool = False) -> list[Experiment]:
    statement = select(Experiment)
    if not include_archived:
        statement = statement.where(Experiment.archived_at.is_(None))
    return list(db.scalars(statement.order_by(Experiment.id)).all())


def get_experiment(db: Session, experiment_id: int) -> Experiment:
    return db.get(Experiment, experiment_id)


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
            db.execute(delete(ExperimentRun).where(ExperimentRun.experiment_id == experiment.id))
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
                    f"{len(experiment_runs)} experiment run(s). The underlying workflow runs "
                    f"(ids {run_ids}) and all their traces, feedback, and learning records are preserved. "
                    "Force-delete will remove the experiment and its run link records only — "
                    "workflow runs and learning data will not be affected."
                ),
            }

    db.delete(experiment)
    db.commit()
    return {"deleted": True, "blocked": False, "experiment_id": experiment.id}


def run_experiment(db: Session, experiment: Experiment) -> ExperimentRun:
    runner = WorkflowRunner(db)
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

        run = runner.run(workflow, experiment.task_prompt)
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
