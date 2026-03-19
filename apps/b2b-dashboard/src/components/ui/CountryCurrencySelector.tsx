"use client";

import React, { useState, useEffect } from "react";
import { Globe, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CountryConfig {
    code: string;
    name: string;
    nameFr: string;
    flag: string;
    defaultCurrency: string;
    supportedCurrencies: string[];
    phoneCode: string;
    supportMobileMoney: boolean;
    mobileMoneyProviders?: string[];
}

// Complete world country list with mobile money support info
// Mobile money: CM, CI, SN, BJ, TG, BF, ML, NE, GN
export const COUNTRIES: CountryConfig[] = [
    // Africa - Mobile Money Supported
    { code: "CM", name: "Cameroon", nameFr: "Cameroun", flag: "🇨🇲", defaultCurrency: "XAF", supportedCurrencies: ["XAF", "EUR", "USD"], phoneCode: "+237", supportMobileMoney: true, mobileMoneyProviders: ["MTN", "Orange", "Moov"] },
    { code: "CI", name: "Ivory Coast", nameFr: "Côte d'Ivoire", flag: "🇨🇮", defaultCurrency: "XOF", supportedCurrencies: ["XOF", "EUR", "USD"], phoneCode: "+225", supportMobileMoney: true, mobileMoneyProviders: ["MTN", "Orange", "Moov"] },
    { code: "SN", name: "Senegal", nameFr: "Sénégal", flag: "🇸🇳", defaultCurrency: "XOF", supportedCurrencies: ["XOF", "EUR", "USD"], phoneCode: "+221", supportMobileMoney: true, mobileMoneyProviders: ["Orange"] },
    { code: "BJ", name: "Benin", nameFr: "Bénin", flag: "🇧🇯", defaultCurrency: "XOF", supportedCurrencies: ["XOF", "EUR", "USD"], phoneCode: "+229", supportMobileMoney: true, mobileMoneyProviders: ["MTN", "Moov"] },
    { code: "TG", name: "Togo", nameFr: "Togo", flag: "🇹🇬", defaultCurrency: "XOF", supportedCurrencies: ["XOF", "EUR", "USD"], phoneCode: "+228", supportMobileMoney: true, mobileMoneyProviders: ["Moov"] },
    { code: "BF", name: "Burkina Faso", nameFr: "Burkina Faso", flag: "🇧🇫", defaultCurrency: "XOF", supportedCurrencies: ["XOF", "EUR", "USD"], phoneCode: "+226", supportMobileMoney: true, mobileMoneyProviders: ["Orange", "MTN"] },
    { code: "ML", name: "Mali", nameFr: "Mali", flag: "🇲🇱", defaultCurrency: "XOF", supportedCurrencies: ["XOF", "EUR", "USD"], phoneCode: "+223", supportMobileMoney: true, mobileMoneyProviders: ["Orange", "MTN"] },
    { code: "NE", name: "Niger", nameFr: "Niger", flag: "🇳🇪", defaultCurrency: "XOF", supportedCurrencies: ["XOF", "EUR", "USD"], phoneCode: "+227", supportMobileMoney: true, mobileMoneyProviders: ["Moov"] },
    { code: "GN", name: "Guinea", nameFr: "Guinée", flag: "🇬🇳", defaultCurrency: "GNF", supportedCurrencies: ["GNF", "EUR", "USD"], phoneCode: "+224", supportMobileMoney: true, mobileMoneyProviders: ["Orange"] },
   
    // Africa - No Mobile Money
    { code: "GH", name: "Ghana", nameFr: "Ghana", flag: "🇬🇭", defaultCurrency: "GHS", supportedCurrencies: ["GHS", "EUR", "USD"], phoneCode: "+233", supportMobileMoney: false },
    { code: "NG", name: "Nigeria", nameFr: "Nigéria", flag: "🇳🇬", defaultCurrency: "NGN", supportedCurrencies: ["NGN", "EUR", "USD"], phoneCode: "+234", supportMobileMoney: false },
    { code: "ZA", name: "South Africa", nameFr: "Afrique du Sud", flag: "🇿🇦", defaultCurrency: "ZAR", supportedCurrencies: ["ZAR", "EUR", "USD"], phoneCode: "+27", supportMobileMoney: false },
    { code: "KE", name: "Kenya", nameFr: "Kenya", flag: "🇰🇪", defaultCurrency: "KES", supportedCurrencies: ["KES", "EUR", "USD"], phoneCode: "+254", supportMobileMoney: false },
    { code: "EG", name: "Egypt", nameFr: "Égypte", flag: "🇪🇬", defaultCurrency: "EGP", supportedCurrencies: ["EGP", "EUR", "USD"], phoneCode: "+20", supportMobileMoney: false },
    { code: "MA", name: "Morocco", nameFr: "Maroc", flag: "🇲🇦", defaultCurrency: "MAD", supportedCurrencies: ["MAD", "EUR", "USD"], phoneCode: "+212", supportMobileMoney: false },
    { code: "TN", name: "Tunisia", nameFr: "Tunisie", flag: "🇹🇳", defaultCurrency: "TND", supportedCurrencies: ["TND", "EUR", "USD"], phoneCode: "+216", supportMobileMoney: false },
    { code: "DZ", name: "Algeria", nameFr: "Algérie", flag: "🇩🇿", defaultCurrency: "DZD", supportedCurrencies: ["DZD", "EUR", "USD"], phoneCode: "+213", supportMobileMoney: false },
    { code: "RW", name: "Rwanda", nameFr: "Rwanda", flag: "🇷🇼", defaultCurrency: "RWF", supportedCurrencies: ["RWF", "EUR", "USD"], phoneCode: "+250", supportMobileMoney: false },
    { code: "ET", name: "Ethiopia", nameFr: "Éthiopie", flag: "🇪🇹", defaultCurrency: "ETB", supportedCurrencies: ["ETB", "EUR", "USD"], phoneCode: "+251", supportMobileMoney: false },
    { code: "TZ", name: "Tanzania", nameFr: "Tanzanie", flag: "🇹🇿", defaultCurrency: "TZS", supportedCurrencies: ["TZS", "EUR", "USD"], phoneCode: "+255", supportMobileMoney: false },
    { code: "UG", name: "Uganda", nameFr: "Ouganda", flag: "🇺🇬", defaultCurrency: "UGX", supportedCurrencies: ["UGX", "EUR", "USD"], phoneCode: "+256", supportMobileMoney: false },
    { code: "AO", name: "Angola", nameFr: "Angola", flag: "🇦🇴", defaultCurrency: "AOA", supportedCurrencies: ["AOA", "EUR", "USD"], phoneCode: "+244", supportMobileMoney: false },
    { code: "CD", name: "DR Congo", nameFr: "RDC", flag: "🇨🇩", defaultCurrency: "CDF", supportedCurrencies: ["CDF", "EUR", "USD"], phoneCode: "+243", supportMobileMoney: false },
    { code: "GA", name: "Gabon", nameFr: "Gabon", flag: "🇬🇦", defaultCurrency: "XAF", supportedCurrencies: ["XAF", "EUR", "USD"], phoneCode: "+241", supportMobileMoney: false },
    { code: "CG", name: "Republic of Congo", nameFr: "Congo", flag: "🇨🇬", defaultCurrency: "XAF", supportedCurrencies: ["XAF", "EUR", "USD"], phoneCode: "+242", supportMobileMoney: false },
    { code: "MR", name: "Mauritania", nameFr: "Mauritanie", flag: "🇲🇷", defaultCurrency: "MRU", supportedCurrencies: ["MRU", "EUR", "USD"], phoneCode: "+222", supportMobileMoney: false },
    { code: "SD", name: "Sudan", nameFr: "Soudan", flag: "🇸🇩", defaultCurrency: "SDG", supportedCurrencies: ["SDG", "EUR", "USD"], phoneCode: "+249", supportMobileMoney: false },
    { code: "ZM", name: "Zambia", nameFr: "Zambie", flag: "🇿🇲", defaultCurrency: "ZMW", supportedCurrencies: ["ZMW", "EUR", "USD"], phoneCode: "+260", supportMobileMoney: false },
    { code: "ZW", name: "Zimbabwe", nameFr: "Zimbabwe", flag: "🇿🇼", defaultCurrency: "ZWL", supportedCurrencies: ["ZWL", "EUR", "USD"], phoneCode: "+263", supportMobileMoney: false },
    { code: "MW", name: "Malawi", nameFr: "Malawi", flag: "🇲🇼", defaultCurrency: "MWK", supportedCurrencies: ["MWK", "EUR", "USD"], phoneCode: "+265", supportMobileMoney: false },
    { code: "MZ", name: "Mozambique", nameFr: "Mozambique", flag: "🇲🇿", defaultCurrency: "MZN", supportedCurrencies: ["MZN", "EUR", "USD"], phoneCode: "+258", supportMobileMoney: false },
    { code: "BW", name: "Botswana", nameFr: "Botswana", flag: "🇧🇼", defaultCurrency: "BWP", supportedCurrencies: ["BWP", "EUR", "USD"], phoneCode: "+267", supportMobileMoney: false },
    { code: "NA", name: "Namibia", nameFr: "Namibie", flag: "🇳🇦", defaultCurrency: "NAD", supportedCurrencies: ["NAD", "EUR", "USD"], phoneCode: "+264", supportMobileMoney: false },
    { code: "LS", name: "Lesotho", nameFr: "Lesotho", flag: "🇱🇸", defaultCurrency: "LSL", supportedCurrencies: ["LSL", "EUR", "USD"], phoneCode: "+266", supportMobileMoney: false },
    { code: "SZ", name: "Eswatini", nameFr: "Eswatini", flag: "🇸🇿", defaultCurrency: "SZL", supportedCurrencies: ["SZL", "EUR", "USD"], phoneCode: "+268", supportMobileMoney: false },
    { code: "MG", name: "Madagascar", nameFr: "Madagascar", flag: "🇲🇬", defaultCurrency: "MGA", supportedCurrencies: ["MGA", "EUR", "USD"], phoneCode: "+261", supportMobileMoney: false },
    { code: "MU", name: "Mauritius", nameFr: "Maurice", flag: "🇲🇺", defaultCurrency: "MUR", supportedCurrencies: ["MUR", "EUR", "USD"], phoneCode: "+230", supportMobileMoney: false },
    { code: "SC", name: "Seychelles", nameFr: "Seychelles", flag: "🇸🇨", defaultCurrency: "SCR", supportedCurrencies: ["SCR", "EUR", "USD"], phoneCode: "+248", supportMobileMoney: false },
    { code: "CV", name: "Cape Verde", nameFr: "Cap-Vert", flag: "🇨🇻", defaultCurrency: "CVE", supportedCurrencies: ["CVE", "EUR", "USD"], phoneCode: "+238", supportMobileMoney: false },
    { code: "GM", name: "Gambia", nameFr: "Gambie", flag: "🇬🇲", defaultCurrency: "GMD", supportedCurrencies: ["GMD", "EUR", "USD"], phoneCode: "+220", supportMobileMoney: false },
    { code: "GW", name: "Guinea-Bissau", nameFr: "Guinée-Bissau", flag: "🇬🇼", defaultCurrency: "XOF", supportedCurrencies: ["XOF", "EUR", "USD"], phoneCode: "+245", supportMobileMoney: false },
    { code: "SL", name: "Sierra Leone", nameFr: "Sierra Leone", flag: "🇸🇱", defaultCurrency: "SLL", supportedCurrencies: ["SLL", "EUR", "USD"], phoneCode: "+232", supportMobileMoney: false },
    { code: "LR", name: "Liberia", nameFr: "Libéria", flag: "🇱🇷", defaultCurrency: "LRD", supportedCurrencies: ["LRD", "EUR", "USD"], phoneCode: "+231", supportMobileMoney: false },
    
    // Europe
    { code: "FR", name: "France", nameFr: "France", flag: "🇫🇷", defaultCurrency: "EUR", supportedCurrencies: ["EUR", "USD", "XAF"], phoneCode: "+33", supportMobileMoney: false },
    { code: "BE", name: "Belgium", nameFr: "Belgique", flag: "🇧🇪", defaultCurrency: "EUR", supportedCurrencies: ["EUR", "USD"], phoneCode: "+32", supportMobileMoney: false },
    { code: "DE", name: "Germany", nameFr: "Allemagne", flag: "🇩🇪", defaultCurrency: "EUR", supportedCurrencies: ["EUR", "USD"], phoneCode: "+49", supportMobileMoney: false },
    { code: "IT", name: "Italy", nameFr: "Italie", flag: "🇮🇹", defaultCurrency: "EUR", supportedCurrencies: ["EUR", "USD"], phoneCode: "+39", supportMobileMoney: false },
    { code: "ES", name: "Spain", nameFr: "Espagne", flag: "🇪🇸", defaultCurrency: "EUR", supportedCurrencies: ["EUR", "USD"], phoneCode: "+34", supportMobileMoney: false },
    { code: "PT", name: "Portugal", nameFr: "Portugal", flag: "🇵🇹", defaultCurrency: "EUR", supportedCurrencies: ["EUR", "USD"], phoneCode: "+351", supportMobileMoney: false },
    { code: "NL", name: "Netherlands", nameFr: "Pays-Bas", flag: "🇳🇱", defaultCurrency: "EUR", supportedCurrencies: ["EUR", "USD"], phoneCode: "+31", supportMobileMoney: false },
    { code: "CH", name: "Switzerland", nameFr: "Suisse", flag: "🇨🇭", defaultCurrency: "CHF", supportedCurrencies: ["CHF", "EUR", "USD"], phoneCode: "+41", supportMobileMoney: false },
    { code: "AT", name: "Austria", nameFr: "Autriche", flag: "🇦🇹", defaultCurrency: "EUR", supportedCurrencies: ["EUR", "USD"], phoneCode: "+43", supportMobileMoney: false },
    { code: "PL", name: "Poland", nameFr: "Pologne", flag: "🇵🇱", defaultCurrency: "PLN", supportedCurrencies: ["PLN", "EUR", "USD"], phoneCode: "+48", supportMobileMoney: false },
    { code: "SE", name: "Sweden", nameFr: "Suède", flag: "🇸🇪", defaultCurrency: "SEK", supportedCurrencies: ["SEK", "EUR", "USD"], phoneCode: "+46", supportMobileMoney: false },
    { code: "NO", name: "Norway", nameFr: "Norvège", flag: "🇳🇴", defaultCurrency: "NOK", supportedCurrencies: ["NOK", "EUR", "USD"], phoneCode: "+47", supportMobileMoney: false },
    { code: "DK", name: "Denmark", nameFr: "Danemark", flag: "🇩🇰", defaultCurrency: "DKK", supportedCurrencies: ["DKK", "EUR", "USD"], phoneCode: "+45", supportMobileMoney: false },
    { code: "FI", name: "Finland", nameFr: "Finlande", flag: "🇫🇮", defaultCurrency: "EUR", supportedCurrencies: ["EUR", "USD"], phoneCode: "+358", supportMobileMoney: false },
    { code: "IE", name: "Ireland", nameFr: "Irlande", flag: "🇮🇪", defaultCurrency: "EUR", supportedCurrencies: ["EUR", "USD"], phoneCode: "+353", supportMobileMoney: false },
    { code: "GB", name: "United Kingdom", nameFr: "Royaume-Uni", flag: "🇬🇧", defaultCurrency: "GBP", supportedCurrencies: ["GBP", "EUR", "USD"], phoneCode: "+44", supportMobileMoney: false },
    { code: "GR", name: "Greece", nameFr: "Grèce", flag: "🇬🇷", defaultCurrency: "EUR", supportedCurrencies: ["EUR", "USD"], phoneCode: "+30", supportMobileMoney: false },
    { code: "CZ", name: "Czech Republic", nameFr: "République tchèque", flag: "🇨🇿", defaultCurrency: "CZK", supportedCurrencies: ["CZK", "EUR", "USD"], phoneCode: "+420", supportMobileMoney: false },
    { code: "HU", name: "Hungary", nameFr: "Hongrie", flag: "🇭🇺", defaultCurrency: "HUF", supportedCurrencies: ["HUF", "EUR", "USD"], phoneCode: "+36", supportMobileMoney: false },
    { code: "RO", name: "Romania", nameFr: "Roumanie", flag: "🇷🇴", defaultCurrency: "RON", supportedCurrencies: ["RON", "EUR", "USD"], phoneCode: "+40", supportMobileMoney: false },
    { code: "BG", name: "Bulgaria", nameFr: "Bulgarie", flag: "🇧🇬", defaultCurrency: "BGN", supportedCurrencies: ["BGN", "EUR", "USD"], phoneCode: "+359", supportMobileMoney: false },
    { code: "HR", name: "Croatia", nameFr: "Croatie", flag: "🇭🇷", defaultCurrency: "EUR", supportedCurrencies: ["EUR", "USD"], phoneCode: "+385", supportMobileMoney: false },
    { code: "SK", name: "Slovakia", nameFr: "Slovaquie", flag: "🇸🇰", defaultCurrency: "EUR", supportedCurrencies: ["EUR", "USD"], phoneCode: "+421", supportMobileMoney: false },
    { code: "SI", name: "Slovenia", nameFr: "Slovénie", flag: "🇸🇮", defaultCurrency: "EUR", supportedCurrencies: ["EUR", "USD"], phoneCode: "+386", supportMobileMoney: false },
    { code: "LT", name: "Lithuania", nameFr: "Lituanie", flag: "🇱🇹", defaultCurrency: "EUR", supportedCurrencies: ["EUR", "USD"], phoneCode: "+370", supportMobileMoney: false },
    { code: "LV", name: "Latvia", nameFr: "Lettonie", flag: "🇱🇻", defaultCurrency: "EUR", supportedCurrencies: ["EUR", "USD"], phoneCode: "+371", supportMobileMoney: false },
    { code: "EE", name: "Estonia", nameFr: "Estonie", flag: "🇪🇪", defaultCurrency: "EUR", supportedCurrencies: ["EUR", "USD"], phoneCode: "+372", supportMobileMoney: false },
    { code: "IS", name: "Iceland", nameFr: "Islande", flag: "🇮🇸", defaultCurrency: "ISK", supportedCurrencies: ["ISK", "EUR", "USD"], phoneCode: "+354", supportMobileMoney: false },
    { code: "LU", name: "Luxembourg", nameFr: "Luxembourg", flag: "🇱🇺", defaultCurrency: "EUR", supportedCurrencies: ["EUR", "USD"], phoneCode: "+352", supportMobileMoney: false },
    { code: "MT", name: "Malta", nameFr: "Malte", flag: "🇲🇹", defaultCurrency: "EUR", supportedCurrencies: ["EUR", "USD"], phoneCode: "+356", supportMobileMoney: false },
    { code: "CY", name: "Cyprus", nameFr: "Chypre", flag: "🇨🇾", defaultCurrency: "EUR", supportedCurrencies: ["EUR", "USD"], phoneCode: "+357", supportMobileMoney: false },
    
    // Americas
    { code: "US", name: "United States", nameFr: "États-Unis", flag: "🇺🇸", defaultCurrency: "USD", supportedCurrencies: ["USD", "EUR"], phoneCode: "+1", supportMobileMoney: false },
    { code: "CA", name: "Canada", nameFr: "Canada", flag: "🇨🇦", defaultCurrency: "CAD", supportedCurrencies: ["CAD", "USD", "EUR"], phoneCode: "+1", supportMobileMoney: false },
    { code: "MX", name: "Mexico", nameFr: "Mexique", flag: "🇲🇽", defaultCurrency: "MXN", supportedCurrencies: ["MXN", "USD", "EUR"], phoneCode: "+52", supportMobileMoney: false },
    { code: "BR", name: "Brazil", nameFr: "Brésil", flag: "🇧🇷", defaultCurrency: "BRL", supportedCurrencies: ["BRL", "USD", "EUR"], phoneCode: "+55", supportMobileMoney: false },
    { code: "AR", name: "Argentina", nameFr: "Argentine", flag: "🇦🇷", defaultCurrency: "ARS", supportedCurrencies: ["ARS", "USD", "EUR"], phoneCode: "+54", supportMobileMoney: false },
    { code: "CO", name: "Colombia", nameFr: "Colombie", flag: "🇨🇴", defaultCurrency: "COP", supportedCurrencies: ["COP", "USD", "EUR"], phoneCode: "+57", supportMobileMoney: false },
    { code: "CL", name: "Chile", nameFr: "Chili", flag: "🇨🇱", defaultCurrency: "CLP", supportedCurrencies: ["CLP", "USD", "EUR"], phoneCode: "+56", supportMobileMoney: false },
    { code: "PE", name: "Peru", nameFr: "Pérou", flag: "🇵🇪", defaultCurrency: "PEN", supportedCurrencies: ["PEN", "USD", "EUR"], phoneCode: "+51", supportMobileMoney: false },
    { code: "VE", name: "Venezuela", nameFr: "Venezuela", flag: "🇻🇪", defaultCurrency: "VES", supportedCurrencies: ["VES", "USD", "EUR"], phoneCode: "+58", supportMobileMoney: false },
    { code: "EC", name: "Ecuador", nameFr: "Équateur", flag: "🇪🇨", defaultCurrency: "USD", supportedCurrencies: ["USD", "EUR"], phoneCode: "+593", supportMobileMoney: false },
    { code: "BO", name: "Bolivia", nameFr: "Bolivie", flag: "🇧🇴", defaultCurrency: "BOB", supportedCurrencies: ["BOB", "USD", "EUR"], phoneCode: "+591", supportMobileMoney: false },
    { code: "PY", name: "Paraguay", nameFr: "Paraguay", flag: "🇵🇾", defaultCurrency: "PYG", supportedCurrencies: ["PYG", "USD", "EUR"], phoneCode: "+595", supportMobileMoney: false },
    { code: "UY", name: "Uruguay", nameFr: "Uruguay", flag: "🇺🇾", defaultCurrency: "UYU", supportedCurrencies: ["UYU", "USD", "EUR"], phoneCode: "+598", supportMobileMoney: false },
    { code: "GT", name: "Guatemala", nameFr: "Guatemala", flag: "🇬🇹", defaultCurrency: "GTQ", supportedCurrencies: ["GTQ", "USD", "EUR"], phoneCode: "+502", supportMobileMoney: false },
    { code: "HN", name: "Honduras", nameFr: "Honduras", flag: "🇭🇳", defaultCurrency: "HNL", supportedCurrencies: ["HNL", "USD", "EUR"], phoneCode: "+504", supportMobileMoney: false },
    { code: "SV", name: "El Salvador", nameFr: "Salvador", flag: "🇸🇻", defaultCurrency: "USD", supportedCurrencies: ["USD", "EUR"], phoneCode: "+503", supportMobileMoney: false },
    { code: "NI", name: "Nicaragua", nameFr: "Nicaragua", flag: "🇳🇮", defaultCurrency: "NIO", supportedCurrencies: ["NIO", "USD", "EUR"], phoneCode: "+505", supportMobileMoney: false },
    { code: "CR", name: "Costa Rica", nameFr: "Costa Rica", flag: "🇨🇷", defaultCurrency: "CRC", supportedCurrencies: ["CRC", "USD", "EUR"], phoneCode: "+506", supportMobileMoney: false },
    { code: "PA", name: "Panama", nameFr: "Panama", flag: "🇵🇦", defaultCurrency: "PAB", supportedCurrencies: ["PAB", "USD", "EUR"], phoneCode: "+507", supportMobileMoney: false },
    { code: "DO", name: "Dominican Republic", nameFr: "République dominicaine", flag: "🇩🇴", defaultCurrency: "DOP", supportedCurrencies: ["DOP", "USD", "EUR"], phoneCode: "+809", supportMobileMoney: false },
    { code: "CU", name: "Cuba", nameFr: "Cuba", flag: "🇨🇺", defaultCurrency: "CUP", supportedCurrencies: ["CUP", "USD", "EUR"], phoneCode: "+53", supportMobileMoney: false },
    { code: "JM", name: "Jamaica", nameFr: "Jamaïque", flag: "🇯🇲", defaultCurrency: "JMD", supportedCurrencies: ["JMD", "USD", "EUR"], phoneCode: "+876", supportMobileMoney: false },
    { code: "TT", name: "Trinidad and Tobago", nameFr: "Trinité-et-Tobago", flag: "🇹🇹", defaultCurrency: "TTD", supportedCurrencies: ["TTD", "USD", "EUR"], phoneCode: "+868", supportMobileMoney: false },
    { code: "BS", name: "Bahamas", nameFr: "Bahamas", flag: "🇧🇸", defaultCurrency: "BSD", supportedCurrencies: ["BSD", "USD", "EUR"], phoneCode: "+242", supportMobileMoney: false },
    { code: "BB", name: "Barbados", nameFr: "Barbade", flag: "🇧🇧", defaultCurrency: "BBD", supportedCurrencies: ["BBD", "USD", "EUR"], phoneCode: "+246", supportMobileMoney: false },
    
    // Asia
    { code: "JP", name: "Japan", nameFr: "Japon", flag: "🇯🇵", defaultCurrency: "JPY", supportedCurrencies: ["JPY", "USD", "EUR"], phoneCode: "+81", supportMobileMoney: false },
    { code: "CN", name: "China", nameFr: "Chine", flag: "🇨🇳", defaultCurrency: "CNY", supportedCurrencies: ["CNY", "USD", "EUR"], phoneCode: "+86", supportMobileMoney: false },
    { code: "KR", name: "South Korea", nameFr: "Corée du Sud", flag: "🇰🇷", defaultCurrency: "KRW", supportedCurrencies: ["KRW", "USD", "EUR"], phoneCode: "+82", supportMobileMoney: false },
    { code: "IN", name: "India", nameFr: "Inde", flag: "🇮🇳", defaultCurrency: "INR", supportedCurrencies: ["INR", "USD", "EUR"], phoneCode: "+91", supportMobileMoney: false },
    { code: "ID", name: "Indonesia", nameFr: "Indonésie", flag: "🇮🇩", defaultCurrency: "IDR", supportedCurrencies: ["IDR", "USD", "EUR"], phoneCode: "+62", supportMobileMoney: false },
    { code: "TH", name: "Thailand", nameFr: "Thaïlande", flag: "🇹🇭", defaultCurrency: "THB", supportedCurrencies: ["THB", "USD", "EUR"], phoneCode: "+66", supportMobileMoney: false },
    { code: "VN", name: "Vietnam", nameFr: "Vietnam", flag: "🇻🇳", defaultCurrency: "VND", supportedCurrencies: ["VND", "USD", "EUR"], phoneCode: "+84", supportMobileMoney: false },
    { code: "PH", name: "Philippines", nameFr: "Philippines", flag: "🇵🇭", defaultCurrency: "PHP", supportedCurrencies: ["PHP", "USD", "EUR"], phoneCode: "+63", supportMobileMoney: false },
    { code: "MY", name: "Malaysia", nameFr: "Malaisie", flag: "🇲🇾", defaultCurrency: "MYR", supportedCurrencies: ["MYR", "USD", "EUR"], phoneCode: "+60", supportMobileMoney: false },
    { code: "SG", name: "Singapore", nameFr: "Singapour", flag: "🇸🇬", defaultCurrency: "SGD", supportedCurrencies: ["SGD", "USD", "EUR"], phoneCode: "+65", supportMobileMoney: false },
    { code: "HK", name: "Hong Kong", nameFr: "Hong Kong", flag: "🇭🇰", defaultCurrency: "HKD", supportedCurrencies: ["HKD", "USD", "EUR"], phoneCode: "+852", supportMobileMoney: false },
    { code: "TW", name: "Taiwan", nameFr: "Taïwan", flag: "🇹🇼", defaultCurrency: "TWD", supportedCurrencies: ["TWD", "USD", "EUR"], phoneCode: "+886", supportMobileMoney: false },
    { code: "PK", name: "Pakistan", nameFr: "Pakistan", flag: "🇵🇰", defaultCurrency: "PKR", supportedCurrencies: ["PKR", "USD", "EUR"], phoneCode: "+92", supportMobileMoney: false },
    { code: "BD", name: "Bangladesh", nameFr: "Bangladesh", flag: "🇧🇩", defaultCurrency: "BDT", supportedCurrencies: ["BDT", "USD", "EUR"], phoneCode: "+880", supportMobileMoney: false },
    { code: "LK", name: "Sri Lanka", nameFr: "Sri Lanka", flag: "🇱🇰", defaultCurrency: "LKR", supportedCurrencies: ["LKR", "USD", "EUR"], phoneCode: "+94", supportMobileMoney: false },
    { code: "NP", name: "Nepal", nameFr: "Népal", flag: "🇳🇵", defaultCurrency: "NPR", supportedCurrencies: ["NPR", "USD", "EUR"], phoneCode: "+977", supportMobileMoney: false },
    { code: "MM", name: "Myanmar", nameFr: "Birmanie", flag: "🇲🇲", defaultCurrency: "MMK", supportedCurrencies: ["MMK", "USD", "EUR"], phoneCode: "+95", supportMobileMoney: false },
    { code: "KH", name: "Cambodia", nameFr: "Cambodge", flag: "🇰🇭", defaultCurrency: "KHR", supportedCurrencies: ["KHR", "USD", "EUR"], phoneCode: "+855", supportMobileMoney: false },
    { code: "LA", name: "Laos", nameFr: "Laos", flag: "🇱🇦", defaultCurrency: "LAK", supportedCurrencies: ["LAK", "USD", "EUR"], phoneCode: "+856", supportMobileMoney: false },
    { code: "BN", name: "Brunei", nameFr: "Brunéi", flag: "🇧🇳", defaultCurrency: "BND", supportedCurrencies: ["BND", "USD", "EUR"], phoneCode: "+673", supportMobileMoney: false },
    { code: "AE", name: "United Arab Emirates", nameFr: "Émirats arabes unis", flag: "🇦🇪", defaultCurrency: "AED", supportedCurrencies: ["AED", "USD", "EUR"], phoneCode: "+971", supportMobileMoney: false },
    { code: "SA", name: "Saudi Arabia", nameFr: "Arabie saoudite", flag: "🇸🇦", defaultCurrency: "SAR", supportedCurrencies: ["SAR", "USD", "EUR"], phoneCode: "+966", supportMobileMoney: false },
    { code: "QA", name: "Qatar", nameFr: "Qatar", flag: "🇶🇦", defaultCurrency: "QAR", supportedCurrencies: ["QAR", "USD", "EUR"], phoneCode: "+974", supportMobileMoney: false },
    { code: "KW", name: "Kuwait", nameFr: "Koweït", flag: "🇰🇼", defaultCurrency: "KWD", supportedCurrencies: ["KWD", "USD", "EUR"], phoneCode: "+965", supportMobileMoney: false },
    { code: "BH", name: "Bahrain", nameFr: "Bahreïn", flag: "🇧🇭", defaultCurrency: "BHD", supportedCurrencies: ["BHD", "USD", "EUR"], phoneCode: "+973", supportMobileMoney: false },
    { code: "OM", name: "Oman", nameFr: "Oman", flag: "🇴🇲", defaultCurrency: "OMR", supportedCurrencies: ["OMR", "USD", "EUR"], phoneCode: "+968", supportMobileMoney: false },
    { code: "JO", name: "Jordan", nameFr: "Jordanie", flag: "🇯🇴", defaultCurrency: "JOD", supportedCurrencies: ["JOD", "USD", "EUR"], phoneCode: "+962", supportMobileMoney: false },
    { code: "LB", name: "Lebanon", nameFr: "Liban", flag: "🇱🇧", defaultCurrency: "LBP", supportedCurrencies: ["LBP", "USD", "EUR"], phoneCode: "+961", supportMobileMoney: false },
    { code: "IL", name: "Israel", nameFr: "Isaël", flag: "🇮🇱", defaultCurrency: "ILS", supportedCurrencies: ["ILS", "USD", "EUR"], phoneCode: "+972", supportMobileMoney: false },
    { code: "TR", name: "Turkey", nameFr: "Turquie", flag: "🇹🇷", defaultCurrency: "TRY", supportedCurrencies: ["TRY", "USD", "EUR"], phoneCode: "+90", supportMobileMoney: false },
    
    // Oceania
    { code: "AU", name: "Australia", nameFr: "Australie", flag: "🇦🇺", defaultCurrency: "AUD", supportedCurrencies: ["AUD", "USD", "EUR"], phoneCode: "+61", supportMobileMoney: false },
    { code: "NZ", name: "New Zealand", nameFr: "Nouvelle-Zélande", flag: "🇳🇿", defaultCurrency: "NZD", supportedCurrencies: ["NZD", "USD", "EUR"], phoneCode: "+64", supportMobileMoney: false },
    { code: "FJ", name: "Fiji", nameFr: "Fidji", flag: "🇫🇯", defaultCurrency: "FJD", supportedCurrencies: ["FJD", "USD", "EUR"], phoneCode: "+679", supportMobileMoney: false },
    { code: "PG", name: "Papua New Guinea", nameFr: "Papouasie-Nouvelle-Guinée", flag: "🇵🇬", defaultCurrency: "PGK", supportedCurrencies: ["PGK", "USD", "EUR"], phoneCode: "+675", supportMobileMoney: false },
    
    // Other
    { code: "OTHER", name: "Other Country", nameFr: "Autre pays", flag: "🌍", defaultCurrency: "EUR", supportedCurrencies: ["EUR", "USD", "XAF", "XOF"], phoneCode: "+", supportMobileMoney: false },
];

interface CountryCurrencySelectorProps {
    selectedCountry: string;
    selectedCurrency: string;
    onCountryChange: (country: CountryConfig) => void;
    onCurrencyChange: (currency: string) => void;
    className?: string;
}

export function CountryCurrencySelector({
    selectedCountry,
    selectedCurrency,
    onCountryChange,
    onCurrencyChange,
    className,
}: CountryCurrencySelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        setMounted(true);
    }, []);

    const currentCountry =
        COUNTRIES.find((c) => c.code === selectedCountry) || COUNTRIES[0];

    // Filter countries by search term
    const filteredCountries = COUNTRIES.filter(
        (country) =>
            country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            country.nameFr.toLowerCase().includes(searchTerm.toLowerCase()) ||
            country.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!mounted) return null;

    return (
        <div className={cn("space-y-3", className)}>
            {/* Country Selector */}
            <div>
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-2">
                    Pays de paiement
                </label>
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className={cn(
                            "w-full flex items-center justify-between px-4 py-3 rounded-xl",
                            "bg-white/5 border border-white/10 text-text-main",
                            "hover:bg-white/10 hover:border-white/20 transition-all duration-200"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-xl">{currentCountry.flag}</span>
                            <span className="font-medium">{currentCountry.nameFr}</span>
                        </div>
                        <ChevronDown
                            className={cn(
                                "h-4 w-4 text-text-muted transition-transform duration-200",
                                isOpen && "rotate-180"
                            )}
                        />
                    </button>

                    {/* Dropdown */}
                    {isOpen && (
                        <>
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => {
                                    setIsOpen(false);
                                    setSearchTerm("");
                                }}
                            />
                            <div
                                className={cn(
                                    "absolute z-50 top-full left-0 right-0 mt-2",
                                    "bg-surface border border-white/10 rounded-xl shadow-2xl",
                                    "max-h-[400px] overflow-hidden flex flex-col"
                                )}
                            >
                                {/* Search Input */}
                                <div className="p-3 border-b border-white/10">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                                        <input
                                            type="text"
                                            placeholder="Rechercher un pays..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-10 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-text-main placeholder-text-muted focus:outline-none focus:border-primary"
                                            autoFocus
                                        />
                                    </div>
                                </div>
                                
                                {/* Country List */}
                                <div className="overflow-y-auto custom-scrollbar flex-1">
                                    {filteredCountries.map((country) => (
                                        <button
                                            key={country.code}
                                            type="button"
                                            onClick={() => {
                                                onCountryChange(country);
                                                // Auto-select default currency for country
                                                if (!country.supportedCurrencies.includes(selectedCurrency)) {
                                                    onCurrencyChange(country.defaultCurrency);
                                                }
                                                setIsOpen(false);
                                                setSearchTerm("");
                                            }}
                                            className={cn(
                                                "w-full flex items-center gap-3 px-4 py-3 text-left",
                                                "hover:bg-white/5 transition-colors",
                                                selectedCountry === country.code && "bg-primary/10"
                                            )}
                                        >
                                            <span className="text-xl">{country.flag}</span>
                                            <div className="flex-1">
                                                <span className="font-medium text-text-main block">
                                                    {country.nameFr}
                                                </span>
                                                <span className="text-xs text-text-muted">
                                                    {country.defaultCurrency}
                                                </span>
                                            </div>
                                            {country.supportMobileMoney && (
                                                <span className="text-[10px] text-success bg-success/10 px-2 py-0.5 rounded">
                                                    MM
                                                </span>
                                            )}
                                            {selectedCountry === country.code && (
                                                <span className="ml-auto text-primary text-xs font-bold">
                                                    ✓
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Currency Selector */}
            <div>
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-2">
                    Devise
                </label>
                <div className="grid grid-cols-3 gap-2">
                    {currentCountry.supportedCurrencies.map((currency) => (
                        <button
                            key={currency}
                            type="button"
                            onClick={() => onCurrencyChange(currency)}
                            className={cn(
                                "py-2.5 px-3 rounded-lg text-xs font-bold transition-all",
                                selectedCurrency === currency
                                    ? "bg-primary text-white shadow-glow-sm"
                                    : "bg-white/5 text-text-muted hover:bg-white/10 hover:text-text-main"
                            )}
                        >
                            {currency}
                        </button>
                    ))}
                </div>
                {selectedCurrency !== currentCountry.defaultCurrency && (
                    <p className="text-[10px] text-text-muted mt-2 flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {currentCountry.defaultCurrency} suggéré pour {currentCountry.nameFr}
                    </p>
                )}
            </div>
        </div>
    );
}

export default CountryCurrencySelector;
