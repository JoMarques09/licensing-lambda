## Usage, licensing and support

This code is provided as an example to consume Paddle webhooks and deliver/verify/activate licenses. End users may use or modify the code as required subject to the [license](http://www.apache.org/licenses/LICENSE-2.0.txt) included.

Paddle does not provide technical support or maintenance for this plugin or any derivations of it.


## Setup

### DynamoDB

You will need two DynamoDB tables
* `paddle_licenses` for storing Licenses
* `paddle_license_activations` for storing Activations against a License

`paddle_license_activations` should have a GSI (Global Secondary Index) name `LICENCE_CODE`

Once you have created these tables, make sure the names match in `template.yaml` on  Line 13 & 14.

When running this Lambda either locally or when deployed you should ensure the AWS Role or User has the policy/permissions to access these tables.


### Webhooks

For Paddle Webhooks to work correctly you should first obtain your Public Key from the  [Dashboard](https://vendors.paddle.com/public-key).

You should put this value into the `PUBLIC_KEY` on Line 12 in `webhook.js`

Licenses have an associated maximum number of allowed activation (unique activations  per unique machine, based on the uuid ). To change this value you can alter Line 10 in 
`webhook.js` 


## Local Development

To test locally you can start the lambda `sam local start-api`

Once running you should use a service like ngrok to provide a public URL tunnelling to  your local lambda service.

Once ngrok is running you can enter the provided url followed by /webhook into the Webhook Simulator on [Paddle’s dashboard](https://vendors.paddle.com/webhook-alert-test)


## Deployment

There are many ways to deploy depending on your setup but to get started you can use the following commands. Once completed, the Lambda project will be setup with the API gateway configured. (Note: For this example you will need an S3 bucket to store the  package before deploying). 

```
sam package --template-file template.yaml --output-file output-package.yaml --s3- bucket your-bucket-name
```

```
sam deploy --template-file output-package.yaml --stack-name paddle-licensing -- capabilities CAPABILITY_IAM
```

## License Delivery

When an SDK product is purchased a license is generated and delivered to the buyer by Paddle. Any other products  will require a license to be generated and delivered to the buyers.

In this project you can use a Paddle SDK product which means you don’t need to generate the license neither do you have to worry about delivering to you buyers.

But if you want to use a normal product we’ve also provided code that generates licenses for you. Please note that you will need to implement your own method of delivering this license to your customer via email. In `webhook.js` on Line 92, there is a function named `deliverLicense(licenseCode,  email)` so you can add your code there. The `licenseCode` and `email` of the customer is passed to this function ready to use. 


## Usage

Once a webhook has been received from Paddle and a license has been generated or stored,  it’s down to you to call the activate, verify and deactivate licenses methods. 

There are three simple methods to achieve this
* `license/activate`
* `license/verify`
* `license/deactivate` 

All of these methods will return a `200` on success or a `400` on fail. Examples of using each below


### Activate

This expects a `licence` and a `uuid` (a unique identifier for the machine activating the license, usually a MAC address) as a `POST` request with the body being `JSON`.

```
curl --location --request POST 'http://127.0.0.1:3010/license/activate' \ --header 'Content-Type: application/json' \ 
--data-raw '{"licence": "some-licence-code", "uuid": "aa:bb:cc:dd:ff:00"}' 
```

On success this will return a 200 with the following response 

```
{ 
 "message": "License Activated", 
 "activation_id": "a2442588-23e1-4adf-a3d3-65779bfd4b2c" 
} 
```

At this point you would be responsible for locally storing the `activation_id` and `licence` for later use. 
If the `uuid` has already been used to activate this license then a new activation will not be  created and the existing `activation_id` returned.  




### Verify

Using the `activation_id` you can periodically call this project to verify the activation. For example:

```
curl --location --request POST 'http://127.0.0.1:3007/license/verify' \ --header 'Content-Type: application/json' \ 
--data-raw '{"licence": "some-licence-code", "activation_id":  
"056d928b-1f3b-4681-a2bb-39f1680a7019"}'
```

On success this will return a 200 response with the following body 

```
{ 
 "message": "Licence and Activation Verified"
 } 
```



### Deactivate

Similarly using the `activation_id` you can deactivate an activation. For example:

```
curl --location --request POST 'http://127.0.0.1:3007/license/deactivate' \ --header 'Content-Type: application/json' \ 
--data-raw '{"activation_id": "056d928b-1f3b-4681-a2bb-39f1680a7019"}' 
```

On success this will return a 200 response with the following body 
```
{ 
 "message": "Successfully Deactivated License" 
} 
```