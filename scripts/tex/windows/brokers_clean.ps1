<#
  Delete all user-created Kafka topics and all RabbitMQ queues.
  Leaves Kafka internal topics (for example __consumer_offsets) untouched.
#>

$ScriptDir = $PSScriptRoot
$EnvScript = Join-Path $ScriptDir "env.ps1"
if (Test-Path $EnvScript) { . $EnvScript }

if (-not (Get-Command curl -ErrorAction SilentlyContinue)) {
    Write-Host "[brokers_clean] curl not found."
    exit 1
}

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "[brokers_clean] python not found."
    exit 1
}

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    Write-Host "[brokers_clean] java not found. Ensure HELIX_JAVA_HOME is valid."
    exit 1
}

Write-Host "[brokers_clean] Cleaning Kafka topics..."
$topics = & /usr/local/opt/kafka/bin/kafka-topics --bootstrap-server $Env:HELIX_KAFKA_BOOTSTRAP_SERVERS --list | Where-Object { $_ -notmatch '^__' }
if ($topics) {
    foreach ($topic in $topics) {
        if ([string]::IsNullOrWhiteSpace($topic)) { continue }
        Write-Host "[brokers_clean] deleting kafka topic $topic"
        & /usr/local/opt/kafka/bin/kafka-topics --bootstrap-server $Env:HELIX_KAFKA_BOOTSTRAP_SERVERS --delete --topic $topic
    }
} else {
    Write-Host "[brokers_clean] no user kafka topics found"
}

Write-Host "[brokers_clean] Cleaning RabbitMQ queues..."
$queuesJson = curl -s -u guest:guest "$Env:HELIX_RABBITMQ_MANAGEMENT_URL/api/queues/%2F"
$queues = $queuesJson | python -c "import json,sys; data=json.load(sys.stdin); [print(q['name']) for q in data]"
if ($queues) {
    foreach ($queue in $queues) {
        if ([string]::IsNullOrWhiteSpace($queue)) { continue }
        Write-Host "[brokers_clean] deleting rabbitmq queue $queue"
        curl -s -u guest:guest -X DELETE "$Env:HELIX_RABBITMQ_MANAGEMENT_URL/api/queues/%2F/$queue" | Out-Null
    }
} else {
    Write-Host "[brokers_clean] no rabbitmq queues found"
}

Write-Host "[brokers_clean] Remaining Kafka topics:"
& /usr/local/opt/kafka/bin/kafka-topics --bootstrap-server $Env:HELIX_KAFKA_BOOTSTRAP_SERVERS --list | Sort-Object

Write-Host "[brokers_clean] Remaining RabbitMQ queues:"
$remainingQueues = curl -s -u guest:guest "$Env:HELIX_RABBITMQ_MANAGEMENT_URL/api/queues/%2F"
$remainingQueues | python -c "import json,sys; data=json.load(sys.stdin); print(len(data)); [print(q['name']) for q in data]"
