#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { oneNodeEcs } from '../lib/1node-ecs'

const app = new cdk.App();
new oneNodeEcs(app, 'oneNodeEcs')

