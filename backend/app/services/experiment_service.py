from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.models.experiment import Experiment, ExperimentRun
from app.models.workflow import Workflow
from app.runtime.workflow_runner import WorkflowRunner
from app.schemas.experiments import ExperimentCreate


def list_experiments(db: Session) -> list[Experiment]:
    return list(db.scalars(select(Experiment).order_by(Experiment.id)).all())


def get_experiment(db: Session, experiment_id: int) -> Experiment:
    return db.get(Experiment, experiment_id)


def create_experiment(db: Session, payload: ExperimentCreate) -> Experiment:
    experiment = Experiment(**payload.model_dump())
    db.add(experiment)
    db.commit()
    db.refresh(experiment)
    return experiment


def delete_experiment(db: Session, experiment: Experiment, force: bool = False) -> dict:
    experiment_runs = db.scalars(
        select(ExperimentRun).where(ExperimentRun.experiment_id == experiment.id)
    ).all()

    if experiment_runs:
        if force:
            for er in experiment_runs:
                db.delete(er)
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
                    f"Cannot delete experiment '{experiment.name}' because it has "
                    f"{len(experiment_runs)} experiment run(s) referencing run ids {run_ids}. "
                    "Delete the experiment runs or the referenced workflow runs first, "
                    "then retry experiment deletion."
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
