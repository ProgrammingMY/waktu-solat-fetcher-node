import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import path from 'path';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

interface PrayerTimesApiStackProps extends cdk.StackProps {
    waktuSolatTable: Table;
}

export class PrayerTimesApiStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: PrayerTimesApiStackProps) {
        super(scope, id, props);

        // Lambda Function
        const apiHandler = new NodejsFunction(this, 'PrayerTimesApiHandler', {
            functionName: 'PrayerTimesApiHandler',
            description: 'API for prayer times',
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'handler',
            entry: path.join(__dirname, '../lambda/api.ts'),
            timeout: cdk.Duration.seconds(30),
            environment: {
                TABLE_NAME: props.waktuSolatTable.tableName
            }
        });

        // Give Lambda permission to read from DynamoDB
        props.waktuSolatTable.grantReadData(apiHandler);

        // API Gateway
        const api = new apigateway.RestApi(this, 'PrayerTimesApi', {
            restApiName: 'prayer-times-api',
            deployOptions: {
                stageName: 'prod',
            },
            endpointTypes: [apigateway.EndpointType.EDGE],
        });

        // API Gateway Integration
        const prayerTimes = api.root.addResource('prayer-times');
        prayerTimes.addMethod('GET', new apigateway.LambdaIntegration(apiHandler));

        // Output the API URL
        new cdk.CfnOutput(this, 'ApiUrl', {
            value: api.url,
            description: 'API Gateway URL',
        });
    }
}