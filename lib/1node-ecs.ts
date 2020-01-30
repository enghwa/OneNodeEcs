import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import ecs = require('@aws-cdk/aws-ecs');
import logs = require('@aws-cdk/aws-logs');
import autoscaling = require('@aws-cdk/aws-autoscaling');
import servicediscovery = require('@aws-cdk/aws-servicediscovery');

export class oneNodeEcs extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "oneNodeEcsVPC", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Web',
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    })

    const logGroup = new logs.LogGroup(this, "oneNodeEcsLogGroup", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.ONE_WEEK
    })
    const asgSpot = new autoscaling.AutoScalingGroup(this, "SpotFleet1", {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3A, ec2.InstanceSize.MICRO),
      machineImage: new ecs.EcsOptimizedAmi(),
      spotPrice: '0.0030',
      updateType: autoscaling.UpdateType.REPLACING_UPDATE,
      desiredCapacity: 1,
      maxCapacity: 1,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      vpc
    })
    asgSpot.connections.allowFromAnyIpv4(ec2.Port.tcp(80));

    const ecsCluster = new ecs.Cluster(this, 'oneNodeEcsCluster', {
      vpc,
      defaultCloudMapNamespace: {
        name: "onenodeecs.service",
        type: servicediscovery.NamespaceType.DNS_PRIVATE
      }
    });
    ecsCluster.addAutoScalingGroup(asgSpot, {
      spotInstanceDraining: true
    });


    //---- sample workloads
    new HaProxyDaemonService(this, 'haproxy', {
      cluster: ecsCluster,
      logs: logGroup
    })
    new HaProxyBalancedService(this, 'nginx', {
      cluster: ecsCluster,
      logs: logGroup,
      desiredCount: 2,
      cpu: '256',
      memoryLimitMiB: 128,
      image: ecs.ContainerImage.fromRegistry('nginx'),
      portMappings: {
        containerPort: 80,
        protocol: ecs.Protocol.TCP
      }
    })
    new HaProxyBalancedService(this, 'nyancat', {
      cluster: ecsCluster,
      logs: logGroup,
      desiredCount: 1,
      cpu: '256',
      memoryLimitMiB: 128,
      image: ecs.ContainerImage.fromRegistry('daviey/nyan-cat-web'),
      portMappings: {
        containerPort: 80,
        protocol: ecs.Protocol.TCP
      }
    })
  }
}


export interface HaProxyDaemonServiceProps {
  cluster: ecs.ICluster
  logs: logs.ILogGroup
}

export class HaProxyDaemonService extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: HaProxyDaemonServiceProps) {
    super(scope, id);

    const haproxyTaskDef = new ecs.TaskDefinition(this, 'haproxy-taskdef', {
      memoryMiB: '256',
      cpu: '256',
      networkMode: ecs.NetworkMode.HOST,
      compatibility: ecs.Compatibility.EC2
    })

    const haproxyContainer = haproxyTaskDef.addContainer('haproxyContainer', {
      image: ecs.ContainerImage.fromAsset('haproxy1'),
      memoryReservationMiB: 256,
      logging: new ecs.AwsLogDriver({
        logGroup: props.logs,
        streamPrefix: "haproxy-"
      })
    })
    haproxyContainer.addPortMappings({
      containerPort: 80,
      protocol: ecs.Protocol.TCP
    })

    new ecs.Ec2Service(this, 'haproxy-svc', {
      cluster: props.cluster,
      taskDefinition: haproxyTaskDef,
      daemon: true,
      serviceName: "haproxy",
    })
  }
}

export interface HaProxyBalancedServiceProps {
  cluster: ecs.ICluster
  logs: logs.ILogGroup
  desiredCount: number
  cpu: string
  memoryLimitMiB: number
  image: ecs.ContainerImage
  portMappings: ecs.PortMapping
}

export class HaProxyBalancedService extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: HaProxyBalancedServiceProps) {
    super(scope, id);

    const TaskDef = new ecs.TaskDefinition(this, id + '-taskdef', {
      // memoryMiB: props.memoryMiB,
      cpu: props.cpu,
      networkMode: ecs.NetworkMode.BRIDGE,
      compatibility: ecs.Compatibility.EC2
    })

    TaskDef.addContainer(id + 'container', {
      image: props.image,
      memoryLimitMiB: props.memoryLimitMiB,
      logging: new ecs.AwsLogDriver({
        logGroup: props.logs,
        streamPrefix: id + "-"
      })
    }).addPortMappings(props.portMappings)

    new ecs.Ec2Service(this, id + '-svc', {
      cluster: props.cluster,
      taskDefinition: TaskDef,
      desiredCount: props.desiredCount,
      serviceName: id,
      maxHealthyPercent: 100,
      minHealthyPercent: 0,
      cloudMapOptions: {
        name: "_" + id,
        dnsRecordType: servicediscovery.DnsRecordType.SRV
      }
    })
  }
}
