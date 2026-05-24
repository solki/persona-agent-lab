# Milestone 0 Initialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize the Agent Swarm Lab repository with Git, project directories, environment templates, Docker Compose scaffolding, and English documentation.

**Architecture:** This milestone creates the repository foundation only. It documents the default isolation model, Tool Gateway boundary, scoped memory/context rules, mock LLM starting point, and reproducibility expectations without implementing runtime code.

**Tech Stack:** FastAPI, Pydantic, SQLAlchemy, PostgreSQL, Qdrant abstraction, Next.js, TypeScript, React, Tailwind CSS, Docker Compose, Git.

---

### Task 1: Repository and Directory Scaffold

**Files:**
- Create: `.gitignore`
- Create: `.env.example`
- Create: `docker-compose.yml`
- Create: `backend/.env.example`
- Create: `backend/requirements.txt`
- Create: `backend/app/.gitkeep`
- Create: `backend/tests/.gitkeep`
- Create: `frontend/.env.example`
- Create: `frontend/package.json`
- Create: `frontend/app/.gitkeep`
- Create: `frontend/components/.gitkeep`
- Create: `frontend/lib/.gitkeep`

- [x] **Step 1: Initialize Git if missing**

Run: `git init`

- [x] **Step 2: Create scaffold files**

Create the root, backend, and frontend placeholders needed for later milestones.

- [ ] **Step 3: Verify `.env` is ignored**

Run: `git check-ignore .env backend/.env frontend/.env.local`

Expected: all three paths are ignored.

### Task 2: Documentation Skeleton

**Files:**
- Create: `README.md`
- Create: `docs/setup.md`
- Create: `docs/architecture.md`
- Create: `docs/agent-isolation.md`
- Create: `docs/memory-and-context.md`
- Create: `docs/workflow-runtime.md`
- Create: `docs/experiment-design.md`

- [x] **Step 1: Create English documentation**

Document setup, architecture, isolation, memory/context, workflow runtime, and experiment design.

- [ ] **Step 2: Verify documentation files exist**

Run: `find docs -maxdepth 2 -type f | sort`

Expected: all six project docs plus this implementation plan are listed.

### Task 3: Verification and Commit

**Files:**
- Review: all new Milestone 0 files

- [ ] **Step 1: Show changed files**

Run: `git status --short`

- [ ] **Step 2: Commit**

Run:

```bash
git add .
git commit -m "chore: initialize agent swarm lab project"
```
