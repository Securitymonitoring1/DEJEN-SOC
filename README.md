# 🇪🇹 DEJEN-SOC
# Security Monitoring and Incident Response Platform

## 📌 Project Overview

DEJEN-SOC (Security Monitoring and Incident Response Platform) is a web based cybersecurity platform which allows monitoring of security events, detecting threats, managing alerts and investigating incidents.

This provides a centralised platform for monitoring, investigating suspicious events and responding to incidents.
## 🎯 Purpose
To create a centralised solution for monitoring and incident response. To make managing security events easier, increase visibility of incidents and enable quick investigations and responses to possible cyber threats.
## 🎥 Video Presentation

**Project:** DEJEN-SOC — Security Monitoring and Incident Response Platform

**Duration:** 5 minutes

[▶ Watch the Project Demonstration](PASTE_YOUR_GOOGLE_DRIVE_LINK_HERE)

Key Features

Monitor Security Events

Detect and monitor security events.

Investigate Incidents

Detect, monitor and investigate potential security incidents.

View Alerts

View alerts for suspicious activity.

View Security Information

View security information through a dashboard.

Endpoint Agent Management

Manage agent signups for endpoints.

Investigation Notes

Record investigation notes.

Incident Response

Support incident response processes and actions at endpoints.

Authentication

Secure access to authorised parts of the platform.

Ethiopian Inspired

Create an Ethiopian inspired brand.

Tech Stack

Component

Technology Used

Front End

React, Typescript, Vite

Back End

Python, FastAPI

Database

PostgreSQL

Database

SQL Alchemy

API

REST API

Hosting

Render

Source Control

Git, GitHub

Architecture

The system has 3 main components:

Front End: The interface for viewing the dashboard, security events, alerts, incidents and endpoint agents.

Back End API: Manages the applications logic, authentication, security data and connects the front end with the database.

Database: The PostgreSQL database stores data in the application relating to users, events, alerts, incidents, agents and investigation notes.




#Installation Process

## Run locally

1. Start PostgreSQL:

   ```sh
   docker compose up -d postgres
   ```

2. Create a Python environment, install backend requirements, and set the required environment values from the repository root:

   ```sh
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   export DATABASE_URL='postgresql+psycopg://dejen:dejen_dev_password@localhost:5432/dejen_soc'
   export JWT_SECRET_KEY='replace-this-with-a-long-random-secret'
   ```

3. Create the database tables, create the development admin user, then run FastAPI:

   ```sh
   python -m backend.database.init_db
   python -m backend.create_admin
   python -m backend.seed_samples
   uvicorn backend.main:app --reload --port 8000
   ```

   The development admin is `admin` / `Admin123!`. Change this before using the service outside a local development environment. The API documentation is available at `http://localhost:8000/docs`.

   The optional seed command adds a small, repeatable set of linked events, alerts, and incidents for local exploration. It skips insertion when the sample records already exist.

4. In a second terminal, install frontend dependencies and start Vite:

   ```sh
   cd Frontend
   npm install
   npm run dev
   ```

   Open `http://localhost:3000`. Vite proxies `/auth`, `/dashboard`, `/events`, `/alerts`, `/incidents`, and `/health` to `http://localhost:8000`. Set `VITE_BACKEND_URL` in `Frontend/.env.local` to change the proxy destination. For a same-origin deployment behind a reverse proxy, `VITE_API_URL` can be set to the backend API base URL.

## Supported UI

- Dashboard totals and recent backend events, alerts, and incidents.
- Alert search and status updates (`OPEN`, `INVESTIGATING`, `RESOLVED`), with related event details.
- Incident creation from an existing alert, status updates, assignment, investigation notes, and backend-recorded activity.
- Reports page exports live summary, alert, incident, and event snapshots as PDF or CSV. These files are generated in the browser and are not stored by the backend.
- Threat Hunting searches authenticated backend events with presets, query validation, result inspection, MITRE hints, alert pivots, and analyst-confirmed incident creation. Saved hunts are stored in the browser.

Threat Hunting operates on fields currently stored by the event API. Process names and command context are inferred from event messages when present; destination IPs and other unrecorded fields are shown as unavailable rather than fabricated. Broader MITRE coverage and containment workflows remain outside the current backend API.

## Endpoint agents and VirtualBox lab

See [docs/agent_enrollment_and_lab.md](docs/agent_enrollment_and_lab.md) for graphical enrollment, Windows/Linux setup, both manager/collector directions, VirtualBox networks, firewall rules, audit policy, and a safe brute-force detection test.
