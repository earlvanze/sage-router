# Sage Router on GCP Free-Tier-Style Cloud Run

This deployment is for a public Phase 2 demo of Sage Router on Google Cloud Run.

## Cost posture

- Cloud Run: `min-instances=0`, `max-instances=1`, 512Mi memory.
- No provider/customer API keys are deployed by default.
- Artifact Registry stores one small Python image.
- The service is public for demoability and exposes `/health`.

## Deploy

```bash
export PROJECT_ID=your-gcp-project-id
export REGION=us-central1
./deploy/gcp/cloudrun-deploy.sh
```

The script enables required APIs, creates an Artifact Registry Docker repo if needed, builds the minimal Cloud Run image, deploys the service, and prints the Cloud Run URL.

## Verify

```bash
SERVICE_URL=$(gcloud run services describe sage-router --region us-central1 --format 'value(status.url)')
curl "$SERVICE_URL/health"
```

## Boundary

Do not deploy local OpenClaw configs, customer provider credentials, `.env` files, Dario credentials, or OAuth cookies to Cloud Run. This Phase 2 deployment is a public demo / credibility deployment, not a hosted customer key-custody layer.
