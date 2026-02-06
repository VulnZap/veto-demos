#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT:-plated-valor-467814-h5}"
REGION="us-central1"
ZONE="${REGION}-a"
INSTANCE_NAME="${INSTANCE_NAME:-veto-demo}"
MACHINE_TYPE="${MACHINE_TYPE:-e2-standard-4}"
DOMAIN="${DOMAIN:-demo.runveto.com}"
DNS_ZONE="runveto-com"
IMAGE="us-central1-docker.pkg.dev/${PROJECT_ID}/veto/demo:latest"
STATIC_IP_NAME="veto-demo-ip"

echo "==> Building Docker image..."
docker build --platform linux/amd64 -t "$IMAGE" "$(dirname "$0")/.."

echo "==> Pushing to Artifact Registry..."
docker push "$IMAGE"

echo "==> Reserving static IP (if needed)..."
if ! gcloud compute addresses describe "$STATIC_IP_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" &>/dev/null; then
  gcloud compute addresses create "$STATIC_IP_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION"
fi

STATIC_IP=$(gcloud compute addresses describe "$STATIC_IP_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --format='get(address)')
echo "    Static IP: $STATIC_IP"

echo "==> Setting DNS record ${DOMAIN} -> ${STATIC_IP}..."
# Remove existing A record if present
if gcloud dns record-sets describe "$DOMAIN." \
  --zone="$DNS_ZONE" \
  --type=A \
  --project="$PROJECT_ID" &>/dev/null; then
  OLD_IP=$(gcloud dns record-sets describe "$DOMAIN." \
    --zone="$DNS_ZONE" \
    --type=A \
    --project="$PROJECT_ID" \
    --format='get(rrdatas[0])')
  if [ "$OLD_IP" != "$STATIC_IP" ]; then
    gcloud dns record-sets update "$DOMAIN." \
      --zone="$DNS_ZONE" \
      --type=A \
      --ttl=300 \
      --rrdatas="$STATIC_IP" \
      --project="$PROJECT_ID"
  fi
else
  gcloud dns record-sets create "$DOMAIN." \
    --zone="$DNS_ZONE" \
    --type=A \
    --ttl=300 \
    --rrdatas="$STATIC_IP" \
    --project="$PROJECT_ID"
fi

echo "==> Creating firewall rules (if needed)..."
gcloud compute firewall-rules describe allow-veto-demo-https \
  --project="$PROJECT_ID" &>/dev/null || \
gcloud compute firewall-rules create allow-veto-demo-https \
  --project="$PROJECT_ID" \
  --allow=tcp:80,tcp:443 \
  --target-tags=veto-demo \
  --description="Allow HTTP/HTTPS for Veto demo"

if gcloud compute instances describe "$INSTANCE_NAME" \
  --project="$PROJECT_ID" \
  --zone="$ZONE" &>/dev/null; then
  echo "==> Updating existing instance..."
  gcloud compute instances update-container "$INSTANCE_NAME" \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --container-image="$IMAGE"
else
  echo "==> Creating VM..."
  gcloud compute instances create-with-container "$INSTANCE_NAME" \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --machine-type="$MACHINE_TYPE" \
    --tags=veto-demo \
    --address="$STATIC_IP" \
    --container-image="$IMAGE" \
    --container-env="DISPLAY=:99,DOMAIN=${DOMAIN}" \
    --container-mount-host-path=mount-path=/dev/shm,host-path=/dev/shm,mode=rw \
    --boot-disk-size=50GB \
    --scopes=default
fi

echo "==> Waiting for VM..."
sleep 15

echo ""
echo "============================================"
echo "  https://${DOMAIN}"
echo "============================================"
echo ""
echo "DNS propagation may take a few minutes."
echo "SSL cert will auto-provision on first request."
echo ""
echo "To tear down:"
echo "  gcloud compute instances delete ${INSTANCE_NAME} --zone=${ZONE} --project=${PROJECT_ID} -q"
echo "  gcloud compute addresses delete ${STATIC_IP_NAME} --region=${REGION} --project=${PROJECT_ID} -q"
