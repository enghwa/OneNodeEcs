# One node ECS cluster using Spot Instance 
This will deploy a single node ECS with t3a.micro, in us-east-2 (Ohio), this will give you ~USD $2 for 2vcpu/1Gib.
ECS Tasks will use AWS Cloud Map for service discovery while Ha Proxy provides the load balancing.

![Architecture diagram](images/architecture-1.png)

## Install
```bash

git clone https://github.com/enghwa/OneNodeEcs.git
cd OneNodeEcs
npm install
npx cdk@1.15.0 deploy

```

## Remove

```bash
npx cdk@1.15.0 destroy
```
