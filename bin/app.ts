#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { WaktuSolatStack } from '../lib/waktu-solat-stack';
import { PrayerTimesApiStack } from '../lib/api-stack';

const app = new cdk.App();

// automation stack
const waktuSolatStack = new WaktuSolatStack(app, 'WaktuSolatStack');

// api stack
new PrayerTimesApiStack(app, 'PrayerTimesApiStack', {
    waktuSolatTable: waktuSolatStack.waktuSolatTable,
});