"""Tests for Experiment Insight Analyzer."""


def _create_soul(client, name, decision_style="Decisive"):
    resp = client.post("/souls", json={"name": name, "persona": f"{name} persona.", "decision_style": decision_style, "is_active": True})
    assert resp.status_code == 201
    return resp.json()


def _create_soul_comp_experiment(client):
    """Create and run a soul comparison experiment, returning (experiment, run_ids)."""
    soul_a = _create_soul(client, "TEST-Analyze-Soul-A", decision_style="Decisive, fast")
    soul_b = _create_soul(client, "TEST-Analyze-Soul-B", decision_style="Collaborative, thorough")

    supervisor = client.post(
        "/agents",
        json={"name": "TEST-Analyze-Supervisor", "role": "coordinator", "system_prompt": "Coordinate.", "soul_id": soul_a["id"]},
    ).json()
    worker = client.post(
        "/agents",
        json={"name": "TEST-Analyze-Worker", "role": "worker", "system_prompt": "Work."},
    ).json()
    workflow = client.post(
        "/workflows",
        json={
            "name": "TEST-Analyze-Workflow",
            "workflow_type": "supervisor",
            "graph_config": {"supervisor_agent_id": supervisor["id"], "worker_agent_ids": [worker["id"]], "max_iterations": 5},
        },
    ).json()

    experiment = client.post(
        "/experiments",
        json={
            "name": "TEST Analysis Experiment",
            "task_prompt": "Handle a complaint.",
            "evaluation_config": {
                "experiment_type": "soul_behavior_comparison",
                "workflow_id": workflow["id"],
                "supervisor_agent_id": supervisor["id"],
                "soul_ids": [soul_a["id"], soul_b["id"]],
            },
        },
    ).json()

    client.post(f"/experiments/{experiment['id']}/run")
    return experiment


class TestAnalysisEndpoint:
    def test_analyze_rejects_missing_experiment(self, client):
        resp = client.post("/experiments/99999/analyze", json={})
        assert resp.status_code == 404

    def test_analyze_rejects_experiment_without_runs(self, client):
        soul = _create_soul(client, "TEST-NoRun-Soul")
        supervisor = client.post(
            "/agents", json={"name": "TEST-NoRun-Supv", "role": "coordinator", "system_prompt": "C."},
        ).json()
        worker = client.post(
            "/agents", json={"name": "TEST-NoRun-Work", "role": "worker", "system_prompt": "W."},
        ).json()
        workflow = client.post(
            "/workflows",
            json={"name": "TEST-NoRun-WF", "workflow_type": "supervisor", "graph_config": {"supervisor_agent_id": supervisor["id"], "worker_agent_ids": [worker["id"]]}},
        ).json()
        experiment = client.post(
            "/experiments",
            json={
                "name": "TEST No Run",
                "task_prompt": "Test.",
                "evaluation_config": {"experiment_type": "soul_behavior_comparison", "workflow_id": workflow["id"], "supervisor_agent_id": supervisor["id"], "soul_ids": [soul["id"], soul["id"]]},
            },
        ).json()

        resp = client.post(f"/experiments/{experiment['id']}/analyze", json={"provider": "mock"})
        assert resp.status_code == 400

    def test_mock_analysis_returns_valid_result(self, client):
        experiment = _create_soul_comp_experiment(client)

        resp = client.post(f"/experiments/{experiment['id']}/analyze", json={"provider": "mock"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["experiment_id"] == experiment["id"]
        assert data["provider"] == "mock"
        assert "analysis" in data
        analysis = data["analysis"]
        assert "executive_summary" in analysis
        assert len(analysis["flow_comparison"]) == 2
        assert len(analysis["behavioral_differences"]) >= 1
        assert "signals" in analysis
        assert "caveat" in analysis["signals"]
        assert len(analysis["limitations"]) >= 1
        assert len(analysis["recommended_next_steps"]) >= 1

    def test_mock_analysis_is_stored_in_comparison_result(self, client):
        experiment = _create_soul_comp_experiment(client)

        client.post(f"/experiments/{experiment['id']}/analyze", json={"provider": "mock"})

        runs = client.get(f"/experiments/{experiment['id']}/runs").json()
        assert len(runs) >= 1
        cmp_result = runs[0]["comparison_result"]
        assert "ai_analysis" in cmp_result
        assert cmp_result["ai_analysis"]["result"]["executive_summary"]

    def test_mock_analysis_survives_page_reload(self, client):
        """Simulate page refresh: fresh GET returns persisted ai_analysis."""
        experiment = _create_soul_comp_experiment(client)
        client.post(f"/experiments/{experiment['id']}/analyze", json={"provider": "mock"})

        # Simulate page reload — fresh GET
        runs = client.get(f"/experiments/{experiment['id']}/runs").json()
        assert len(runs) >= 1
        ai = runs[0]["comparison_result"].get("ai_analysis")
        assert ai is not None, "ai_analysis should persist across requests"
        assert ai["result"]["executive_summary"]

    def test_edit_experiment_does_not_delete_ai_analysis(self, client):
        """Editing experiment name/config should not erase ai_analysis."""
        experiment = _create_soul_comp_experiment(client)
        client.post(f"/experiments/{experiment['id']}/analyze", json={"provider": "mock"})

        # Edit experiment name
        client.put(f"/experiments/{experiment['id']}", json={"name": "Updated Name"})

        # ai_analysis should still be there
        runs = client.get(f"/experiments/{experiment['id']}/runs").json()
        assert len(runs) >= 1
        assert "ai_analysis" in runs[0].get("comparison_result", {})

    def test_rerun_creates_fresh_comparison_without_stale_analysis(self, client):
        """Re-running experiment creates new ExperimentRun without ai_analysis."""
        experiment = _create_soul_comp_experiment(client)
        client.post(f"/experiments/{experiment['id']}/analyze", json={"provider": "mock"})

        # Re-run
        client.post(f"/experiments/{experiment['id']}/run")

        # Latest run should NOT have ai_analysis (fresh run)
        runs = client.get(f"/experiments/{experiment['id']}/runs").json()
        assert len(runs) >= 2  # at least two runs now
        latest = runs[0]  # newest first
        assert "ai_analysis" not in latest.get("comparison_result", {}), "Fresh run should not have stale ai_analysis"

    def test_analysis_response_does_not_include_api_key(self, client):
        experiment = _create_soul_comp_experiment(client)

        resp = client.post(
            f"/experiments/{experiment['id']}/analyze",
            json={"provider": "mock", "api_key": "sk-secret-key-12345"},
        )
        assert resp.status_code == 200
        data = resp.json()
        # API key must not appear anywhere in response
        resp_str = str(data)
        assert "sk-secret-key-12345" not in resp_str
        assert "api_key" not in data

    def test_analyze_does_not_create_agents_souls_or_runs(self, client):
        experiment = _create_soul_comp_experiment(client)

        agents_before = client.get("/agents").json()
        souls_before = client.get("/souls").json()
        runs_before = client.get("/runs").json()

        client.post(f"/experiments/{experiment['id']}/analyze", json={"provider": "mock"})

        agents_after = client.get("/agents").json()
        souls_after = client.get("/souls").json()
        runs_after = client.get("/runs").json()

        assert len(agents_after) == len(agents_before)
        assert len(souls_after) == len(souls_before)
        assert len(runs_after) == len(runs_before)

    def test_analyze_rejects_non_soul_comparison_experiment(self, client):
        agent_a = client.post(
            "/agents", json={"name": "TEST-StdAnalyze-A", "role": "worker", "system_prompt": "A."},
        ).json()
        agent_b = client.post(
            "/agents", json={"name": "TEST-StdAnalyze-B", "role": "worker", "system_prompt": "B."},
        ).json()
        experiment = client.post(
            "/experiments",
            json={"name": "TEST Standard", "task_prompt": "Test.", "agent_ids": [agent_a["id"], agent_b["id"]]},
        ).json()
        client.post(f"/experiments/{experiment['id']}/run")

        resp = client.post(f"/experiments/{experiment['id']}/analyze", json={"provider": "mock"})
        assert resp.status_code == 400
