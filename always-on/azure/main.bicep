// Qaio Engine on Azure Container Apps.
//
// Provisions: Container Apps Environment, a Storage Account + File Share for
// the engine's SQLite DB and workspaces, and the Container App itself with
// HTTPS+WebSocket ingress. Provider keys + the engine bearer token are passed
// as secure params and stored as Container App secrets — never in the image.
//
// Deploy with always-on/azure/deploy.sh (builds + pushes the image first).

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Base name used to derive resource names.')
param appName string = 'qaio-engine'

@description('Full image reference in your container registry, e.g. myacr.azurecr.io/qaio/engine:latest')
param image string

@description('Container registry login server, e.g. myacr.azurecr.io')
param registryServer string

@description('Registry username (ACR admin user or service principal appId).')
param registryUsername string

@secure()
@description('Registry password.')
param registryPassword string

@secure()
@description('Bearer token clients must send to the engine. Generate: openssl rand -hex 32')
param engineToken string

@secure()
@description('Anthropic API key for the Claude provider. Empty to disable.')
param anthropicApiKey string = ''

@secure()
@description('OpenAI API key for the Codex provider. Empty to disable.')
param openaiApiKey string = ''

@secure()
@description('Moonshot API key for the Kimi provider. Empty to disable.')
param kimiApiKey string = ''

var storageName = toLower(replace('${appName}stg', '-', ''))
var shareName = 'qaio-data'
var storageMountName = 'qaio-data-mount'

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

resource fileService 'Microsoft.Storage/storageAccounts/fileServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource share 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-05-01' = {
  parent: fileService
  name: shareName
  properties: {
    shareQuota: 16
  }
}

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${appName}-logs'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${appName}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

// Mount the Azure Files share into the environment so the app can use it.
resource envStorage 'Microsoft.App/managedEnvironments/storages@2024-03-01' = {
  parent: env
  name: storageMountName
  properties: {
    azureFile: {
      accountName: storage.name
      accountKey: storage.listKeys().keys[0].value
      shareName: shareName
      accessMode: 'ReadWrite'
    }
  }
}

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      ingress: {
        external: true
        targetPort: 7777
        transport: 'auto' // enables HTTP/1.1 + WebSocket upgrade
        allowInsecure: false
      }
      registries: [
        {
          server: registryServer
          username: registryUsername
          passwordSecretRef: 'registry-password'
        }
      ]
      secrets: [
        { name: 'registry-password', value: registryPassword }
        { name: 'engine-token', value: engineToken }
        { name: 'anthropic-api-key', value: anthropicApiKey }
        { name: 'openai-api-key', value: openaiApiKey }
        { name: 'kimi-api-key', value: kimiApiKey }
      ]
    }
    template: {
      containers: [
        {
          name: appName
          image: image
          resources: {
            cpu: json('1.0')
            memory: '2Gi'
          }
          env: [
            { name: 'QAIO_BIND', value: '0.0.0.0:7777' }
            { name: 'QAIO_BIND_ALL', value: '1' }
            { name: 'QAIO_HOME', value: '/data/.qaio' }
            { name: 'QAIO_DOCS', value: '/data/Qaio' }
            { name: 'RUST_LOG', value: 'info,qaio=debug' }
            { name: 'QAIO_ENGINE_TOKEN', secretRef: 'engine-token' }
            { name: 'ANTHROPIC_API_KEY', secretRef: 'anthropic-api-key' }
            { name: 'OPENAI_API_KEY', secretRef: 'openai-api-key' }
            { name: 'KIMI_API_KEY', secretRef: 'kimi-api-key' }
          ]
          volumeMounts: [
            { volumeName: 'qaio-data', mountPath: '/data' }
          ]
        }
      ]
      volumes: [
        {
          name: 'qaio-data'
          storageType: 'AzureFile'
          storageName: storageMountName
        }
      ]
      scale: {
        // Engine holds in-memory session + WS state, so keep exactly one
        // replica. Do not scale to zero: agents and routines must keep
        // running, and horizontal scaling would split session state.
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
}

@description('Public HTTPS URL of the engine. Use as the remote baseUrl in the Qaio app.')
output engineUrl string = 'https://${app.properties.configuration.ingress.fqdn}'
