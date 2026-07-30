> [!IMPORTANT]
> **This repository is archived and read-only.**
>
> It is an example Harper component and is no longer maintained.
> It is pinned to **HarperDB v4** and is preserved for reference.
> It is **not** kept in sync with current releases and may not be supported in latest Harper versions.
>
> For up-to-date guides and reference docs, see the [Harper docs](https://docs.harper.fast) and join our [Discord](https://harper.fast/discord).

# Harper + Twilio SMS 
A [Harper Systems Component](https://docs.harperdb.io/docs/developers/components) for tracking Twilio SMS opt-outs and opt-ins.

## Why track SMS Opt-In status?
Twilio [recommends tracking your customer's SMS opt out status](https://www.twilio.com/en-us/blog/opt-in-opt-out-text-messages) per carrier and country-based legal compliance regulations regarding messaging:
> As a business, you must follow certain guidelines when adding and removing customers from your text message lists to ensure you only send messages customers want and comply with SMS regulations.

[Keeping track of your user's status](https://www.twilio.com/docs/messaging/tutorials/advanced-opt-out?_gl=1*15g499b*_gcl_au*MjQ1MjAxMDg3LjE3NDk2NTg0NDE.*_ga*MTg2MDM1Nzk5My4xNzM4OTY2MTg5*_ga_RRP8K4M4F3*czE3NTA4NzI0NzEkbzgkZzEkdDE3NTA4NzM1OTckajYwJGwwJGgw#keeping-track-of-your-users-status) (Twilio official docs)
> If you see the OptOutType property in Twilio's request to your application...You may want to store this information, but because Twilio has already sent a confirmation message/reply to your end user, we do not recommend sending another Message back from your application to the end user.

## How to use this Component with Twilio
This component offers an easy to use endpoint and storage system to add as your opt-in status tracker. The phonenumber and status is stored in a Harper datatable for easy access. Whether you are sending one-off SMS messages or a text blast you will need to make sure your customers are opted in before sending.

This component listens on inbound SMS for the [OptOutType Parameter](https://help.twilio.com/articles/31560110671259-How-to-Track-Opt-Out-Opt-In-and-Help-Messages-Using-the-OptOutType-Parameter) and subsequently updates the phone number's corresponding status.

How to listen for inbound messages with OptOutType & use this component:
1. In the Twilio Console, go to _Twilio Messaging Services_
2. Select a service and click on _Integrations_
3. Select _Send a webhook for Incoming Messages_
4. Add https://this-applications-url.com/optInStatus to the Request URL
5. Make sure to leave it as a POST
6. Save!
7. Verify this component is working by texting an opt-in or opt-out keyword to a phone number in the service. This will appear in the Harper datatable PhoneNumbers: accessible either in your [Harper Studio UI](https://docs.harperdb.io/docs/administration/harper-studio) or via the RESTful API endpoint for PhoneNumbers

## Usage

### Local Development
[Install Harper](https://docs.harperdb.io/docs/deployments/install-harper#install) or run `npm i -g harperdb`

git clone this repo & cd to it

npm i

npm run dev

### Endpoints
| Endpoint           | Description                                                     |
| ------------------ | --------------------------------------------------------------- |
| `/optInStatus`     | Supports POST req for inbound Twilio SMS & update optin status  |
| `/PhoneNumbers`    | Direct REST interface for the PhoneNumbers table                |

### Deployment
Deploy this Harper component wherever you like: Linode, AWS, GCP, DigitalOcean, on prem

[Follow the Harper installation guide](https://docs.harperdb.io/docs/deployments/install-harper) on the machine where this will be deployed
