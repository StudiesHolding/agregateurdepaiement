import { generateToken } from '../utils/generateToken.js';
import { generateLinks } from "../utils/generateLinks.js";
import { PaymentIntent } from '../models/PaymentIntent.model.js';
import { PaymentAttempt, PaymentStatus } from '../models/Paymentattempt.model.js';
import { ProviderRoute } from '../models/PaymentRouter.model.js';
import { PaymentProvider } from '../models/PaymentProvider.model.js';
import axios from 'axios';

// A recuperer -montant
/*
    {
        "amount": ""
        "currency": ""
        "emailBuyer": ""
        "formation": ""
        "package": ""

    }
 */
export const linkPayment = (req, res) => {
    const data = req.body;
    const token = generateToken(data);
    const paymentLink = generateLinks(token, req.hostname);
    res.json({ paymentLink }).status(200);
}
export const pinVerification = (req, res) => {
    const data = req.body;
    res.json({ message: "PIN verified successfully" }).status(200);
}

export const InitPaymentMobileMoney = async(req, res) => {
    data = req.body;
    const intent = new PaymentIntent();
    if (data.formation !== "") {
        intent = await PaymentIntent.create({
            amount: data.amount,
            currency: data.currency,
            emailBuyer: data.emailBuyer,
            formation: data.formation,
            package: null
        })
    } else {
        intent = await PaymentIntent.create({
            amount: data.amount,
            currency: data.currency,
            emailBuyer: data.emailBuyer,
            formation: null,
            package: data.package,
        })
    }

    let listProviderProrityByCountry = await ProviderRoute.findAll({
        where: {
            [Op.and]: [
                { countryCode: data.countryCode, },
                { isActive: true },
            ]
        },
        order: [
            ['priority', 'ASC']
        ],
        include: {
            model: PaymentProvider,
            required: true,
            where: {
                supportMobileMoney: true
            }
        }
    });

    for (let item of listProviderProrityByCountry) {
        //Call provider API to init payment
        switch (item.paymentProvider.name) {
            case "CinetPay":
                const requestPayload = {
                    apikey: process.env.CINETPAY_API_KEY,
                    site_id: process.env.CINETPAY_SITE_ID,
                    transaction_id: "",
                    amount: "",
                    currency: "",
                    description: "",
                    notify_url: "",
                    return_url: "",
                    channels: "",
                };
                //Call CinetPay API
                await PaymentAttempt.create({
                    attemptNumber: Math.floor(Math.random() * 1000),
                    requestPayload: JSON.stringify(requestPayload),
                    paymentIntentId: intent.id
                })
                let initCall = await axios.post(process.env.CINETPAY_API_LINK, requestPayload)
                if (initCall.status === 200) {
                    //Exit the loop
                    res.json({ message: "Payment initiated successfully", redirect: initCall.data }).status(200);
                    return;
                }
            case "Maviance":
                //Call Maviance API
                PaymentAttempt.create({
                    attemptNumber: Math.floor(Math.random() * 1000),
                    requestPayload: JSON.stringify(requestPayload),
                    paymentIntentId: intend.id
                })
                initCall = await axios.post(process.env.MAVIANCE_API_LINK, requestPayload)
                if (initCall.status === 200) {
                    //Exit the loop
                    res.json({ message: "Payment initiated successfully", data: initCall.data }).status(200);
                    return;
                }
        }
    }
    res.json({ message: "Payment initiation failed with all providers" }).status(500);
}

export const CardPayment = async(req, res) => {
    //     const data = req.body;
    //     const intend = null;
    //     if (data.formation !== "") {
    //         intend = PaymentIntent.create({
    //             amount: data.amount,
    //             currency: data.currency,
    //             emailBuyer: data.emailBuyer,
    //             formation: data.formation,
    //             package: null
    //         }).then(paymentIntent => {
    //             res.json({ paymentIntent }).status(201);
    //         })
    //     }
    //     if (data.package !== "") {
    //         intend = PaymentIntent.create({
    //             amount: data.amount,
    //             currency: data.currency,
    //             emailBuyer: data.emailBuyer,
    //             formation: null,
    //             package: data.package,
    //         }).then(paymentIntent => {
    //             res.json({ paymentIntent }).status(201);
    //         })
    //     }

    //     let listProviderProrityByCountry = await ProviderRoute.findAll({
    //         where: {
    //             [Op.and]: [
    //                 { countryCode: data.countryCode, },
    //                 { isActive: true },
    //             ]
    //         },
    //         order: [
    //             ['priority', 'ASC']
    //         ],
    //         include: {
    //             model: PaymentProvider,
    //             required: true,
    //             where: {
    //                 supportCard: true
    //             }
    //         }
    //     });

    //     PaymentAttempt.create({
    //         attemptNumber: Math.floor(Math.random() * 1000),
    //         requestPayload: JSON.stringify(requestPayload),
    //         paymentIntentId: intend.id
    //     })
    //     initCall = await fetch(process.env.STRIPE_API_LINK, requestPayload)
    //     if (initCall.status === 200) {
    //         //Exit the loop
    //         res.json({ message: "Payment initiated successfully", data: responsePayload }).status(200);
    //         return;
    //     } else {
    //         res.json({ message: "Payment initiation failed with provider " + listProviderProrityByCountry[0].paymentProvider.name }).status(500);
    //     }
}

export const WebHookHandlerCinetPay = async(req, res) => {
    const data = req.body;

    //Check signature here

    // call for verification
    const requestCheck = {
        apikey: process.env.CINETPAY_API_KEY,
        site_id: process.env.CINETPAY_SITE_ID,
        transaction_id: data.cpm_trans_id
    }
    const check = await axios.post(process.env.CINETPAY_API_CKECK_TRANS_URL, requestCheck)
        //Handle event
    if (check.data.data["status"] === 'ACCEPTED') {
        const attempt = await PaymentAttempt.update({
            where: { transactionNumber: data.cpm_trans_id },
            data: {
                status: PaymentStatus.succeeded,
                responsePayload: JSON.stringify(check)
            }
        })

        await PaymentIntent.update({
            where: { id: attempt.id },
            data: {
                status: PaymentStatus.succeeded,
            }
        })

    }

    if (check.data.data["status"] === 'TRANSACTION_CANCEL') {
        await PaymentAttempt.update({
            where: { transactionNumber: data.cpm_trans_id },
            data: {
                status: PaymentStatus.failed,
                responsePayload: JSON.stringify(check)
            }
        })
    }


}

export const WebHookHandlerStripe = (req, res) => {
    const data = req.body;

    //Check signature here

    //Handle event

}