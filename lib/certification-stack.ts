import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

export class CertificateStack extends cdk.Stack {
    public readonly certificate: acm.Certificate;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, {
            ...props,
            // Force this stack to be created in us-east-1
            env: { region: 'us-east-1' },
        });

        this.certificate = new acm.Certificate(this, 'Certificate', {
            domainName: 'solat.sunnahgarden.my',
            validation: acm.CertificateValidation.fromDns(),
        });

        // Output the certificate ARN
        new cdk.CfnOutput(this, 'CertificateArn', {
            value: this.certificate.certificateArn,
            description: 'Certificate ARN',
            exportName: 'ApiCertificateArn',
        });
    }
}