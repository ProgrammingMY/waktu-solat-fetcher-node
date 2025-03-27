#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { WaktuSolatStack } from '../lib/waktu-solat-stack';

const app = new cdk.App();
new WaktuSolatStack(app, 'WaktuSolatStack'); 