# <img src="https://github.com/pip-services/pip-services/raw/master/design/Logo.png" alt="Pip.Services Logo" style="max-width:30%"> <br/> Integration business process framework in Node.js

<!-- This is Processes microservice from Pip.Services library. 
It stores Processes between internally and external service

The microservice currently supports the following deployment options:
* Deployment platforms: Standalone Process, Seneca
* External APIs: HTTP/REST
* Persistence: Flat Files, MongoDB

This microservice has no dependencies on other microservices.

<a name="links"></a> Quick Links:

* [Download Links](doc/Downloads.md)
* [Development Guide](doc/Development.md)
* [Configuration Guide](doc/Configuration.md)
* [Deployment Guide](doc/Deployment.md)
* Client SDKs
  - [Node.js SDK](https://github.com/pip-services/pip-libs-processes-node)
* Communication Protocols
  - [HTTP Version 1](doc/HttpProtocolV1.md)
 

## Contract

Logical contract of the microservice is presented below. For physical implementation (HTTP/REST, Thrift, Seneca, Lambda, etc.),
please, refer to documentation of the specific protocol.

```typescript
class MappingV1 implements IStringIdentifiable {
    
    public id:string;
    public collection: string;
    public internal_id: string;
    public external_id: string;
    public expiration_time: Date;

}

interface IProcessesController {
    getCollectionNames(correlationId: string, callback: (err: any, items: Array<string>) => void);
    getProcesses(correlationId: string, filter: FilterParams, paging: PagingParams, callback: (err: any, page: DataPage<MappingV1>) => void);
    addMapping(correlationId: string, collection: string, internalId: string, externalId: string, timeToLive: number, callback: (err: any) => void);
    mapToExternal(correlationId: string, collection: string, internalId: string, callback: (err: any, externalId: string) => void);
    mapToInternal(correlationId: string, collection: string, externalId: string, callback: (err: any, internalId: string) => void);
    deleteMapping(correlationId: string, collection: string, internalId: string, externalId: string, callback: (err: any) => void);
    deleteExpiredProcesses(correlationId: string, callback: (err: any) => void);
}
```

## Download

Right now the only way to get the microservice is to check it out directly from github repository
```bash
git clone git@github.com:pip-services-integration/pip-services-processes-node.git
```

Pip.Service team is working to implement packaging and make stable releases available for your 
as zip downloadable archieves.

## Run

Add **config.yml** file to the root of the microservice folder and set configuration parameters.
As the starting point you can use example configuration from **config.example.yml** file. 

Example of microservice configuration
```yaml
- descriptor: "pip-services-container:container-info:default:default:1.0"
  name: "pip-services-processes"
  description: "Processes microservice"

- descriptor: "pip-services-commons:logger:console:default:1.0"
  level: "trace"

- descriptor: "pip-services-processes:persistence:file:default:1.0"
  path: "./data/processes.json"

- descriptor: "pip-services-processes:controller:default:default:1.0"

- descriptor: "pip-services-processes:service:http:default:1.0"
  connection:
    protocol: "http"
    host: "0.0.0.0"
    port: 8080
```
 
For more information on the microservice configuration see [Configuration Guide](Configuration.md).

Start the microservice using the command:
```bash
node run
```

## Use

The easiest way to work with the microservice is to use client SDK. 
The complete list of available client SDKs for different languages is listed in the [Quick Links](#links)

If you use Node.js then you should add dependency to the client SDK into **package.json** file of your project
```javascript
{
    ...
    "dependencies": {
        ....
        "pip-libs-processes-node": "^1.0.*",
        ...
    }
}
```


## Acknowledgements

This microservice was created and currently maintained by *Sergey Seroukhov*. -->
