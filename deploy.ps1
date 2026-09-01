# Setup Variables
$ACCOUNT_ID = "520432095536"
$REGION = "us-east-1"
$REPO = "mystellarterm-backend"
$CLUSTER = "mystellarterm-cluster"
$SERVICE = "mystellarterm-task-service-q8pwdylg"
$ECR_URI = "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
$IMAGE_URI = "${ECR_URI}/${REPO}:latest"

Write-Host "Step 1/5: Building Docker Image..." -ForegroundColor Cyan
docker build -t mystellarterm .
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed!" -ForegroundColor Red; exit }

Write-Host "Step 2/5: Authenticating with AWS ECR..." -ForegroundColor Cyan
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_URI
if ($LASTEXITCODE -ne 0) { Write-Host "Auth failed!" -ForegroundColor Red; exit }

Write-Host "Step 3/5: Tagging Image..." -ForegroundColor Cyan
docker tag mystellarterm:latest $IMAGE_URI

Write-Host "Step 4/5: Pushing Image to ECR..." -ForegroundColor Cyan
docker push $IMAGE_URI
if ($LASTEXITCODE -ne 0) { Write-Host "Push failed!" -ForegroundColor Red; exit }

Write-Host "Step 5/5: Forcing ECS Service Update..." -ForegroundColor Cyan
aws ecs update-service --cluster $CLUSTER --service $SERVICE --force-new-deployment --region $REGION | Out-Null

Write-Host "Deployment initiated! ECS is spinning up the new container now." -ForegroundColor Green