"use client";

import React, { useState, useEffect } from "react";
import { Globe, ChevronDown, Loader2 } from "lucide-react";
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

// Countries with mobile money support (routes configured in backend)
const MOBILE_MONEY_COUNTRIES = ['CM', 'CI', 'SN', 'BJ', 'TG', 'BF', 'ML', 'NE', 'GN'];

export const COUNTRIES: CountryConfig[] = [
    {
        code: "CM",
        name: "Cameroon",
        nameFr: "Cameroun",
        flag: "🇨🇲",
        defaultCurrency: "XAF",
        supportedCurrencies: ["XAF", "EUR", "USD"],
        phoneCode: "+237",
        supportMobileMoney: true,
        mobileMoneyProviders: ["MTN", "Orange", "Moov"],
    },
    {
        code: "CI",
        name: "Ivory Coast",
        nameFr: "Côte d'Ivoire",
        flag: "🇨🇮",
        defaultCurrency: "XOF",
        supportedCurrencies: ["XOF", "EUR", "USD"],
        phoneCode: "+225",
        supportMobileMoney: true,
        mobileMoneyProviders: ["MTN", "Orange", "Moov"],
    },
    {
        code: "SN",
        name: "Senegal",
        nameFr: "Sénégal",
        flag: "🇸🇳",
        defaultCurrency: "XOF",
        supportedCurrencies: ["XOF", "EUR", "USD"],
        phoneCode: "+221",
        supportMobileMoney: true,
        mobileMoneyProviders: ["Orange"],
    },
    {
        code: "BJ",
        name: "Benin",
        nameFr: "Bénin",
        flag: "🇧🇯",
        defaultCurrency: "XOF",
        supportedCurrencies: ["XOF", "EUR", "USD"],
        phoneCode: "+229",
        supportMobileMoney: true,
        mobileMoneyProviders: ["MTN", "Moov"],
    },
    {
        code: "TG",
        name: "Togo",
        nameFr: "Togo",
        flag: "🇹🇬",
        defaultCurrency: "XOF",
        supportedCurrencies: ["XOF", "EUR", "USD"],
        phoneCode: "+228",
        supportMobileMoney: true,
        mobileMoneyProviders: ["Moov"],
    },
    {
        code: "BF",
        name: "Burkina Faso",
        nameFr: "Burkina Faso",
        flag: "🇧🇫",
        defaultCurrency: "XOF",
        supportedCurrencies: ["XOF", "EUR", "USD"],
        phoneCode: "+226",
        supportMobileMoney: true,
        mobileMoneyProviders: ["Orange", "MTN"],
    },
    {
        code: "ML",
        name: "Mali",
        nameFr: "Mali",
        flag: "🇲🇱",
        defaultCurrency: "XOF",
        supportedCurrencies: ["XOF", "EUR", "USD"],
        phoneCode: "+223",
        supportMobileMoney: true,
        mobileMoneyProviders: ["Orange", "MTN"],
    },
    {
        code: "NE",
        name: "Niger",
        nameFr: "Niger",
        flag: "🇳🇪",
        defaultCurrency: "XOF",
        supportedCurrencies: ["XOF", "EUR", "USD"],
        phoneCode: "+227",
        supportMobileMoney: true,
        mobileMoneyProviders: ["Moov"],
    },
    {
        code: "GN",
        name: "Guinea",
        nameFr: "Guinée",
        flag: "🇬🇳",
        defaultCurrency: "GNF",
        supportedCurrencies: ["GNF", "EUR", "USD"],
        phoneCode: "+224",
        supportMobileMoney: true,
        mobileMoneyProviders: ["Orange"],
    },
    {
        code: "GH",
        name: "Ghana",
        nameFr: "Ghana",
        flag: "🇬🇭",
        defaultCurrency: "GHS",
        supportedCurrencies: ["GHS", "EUR", "USD"],
        phoneCode: "+233",
        supportMobileMoney: false,
    },
    {
        code: "NG",
        name: "Nigeria",
        nameFr: "Nigéria",
        flag: "🇳🇬",
        defaultCurrency: "NGN",
        supportedCurrencies: ["NGN", "EUR", "USD"],
        phoneCode: "+234",
        supportMobileMoney: false,
    },
    {
        code: "FR",
        name: "France",
        nameFr: "France",
        flag: "🇫🇷",
        defaultCurrency: "EUR",
        supportedCurrencies: ["EUR", "USD", "XAF"],
        phoneCode: "+33",
        supportMobileMoney: false,
    },
    {
        code: "BE",
        name: "Belgium",
        nameFr: "Belgique",
        flag: "🇧🇪",
        defaultCurrency: "EUR",
        supportedCurrencies: ["EUR", "USD"],
        phoneCode: "+32",
        supportMobileMoney: false,
    },
    {
        code: "CH",
        name: "Switzerland",
        nameFr: "Suisse",
        flag: "🇨🇭",
        defaultCurrency: "CHF",
        supportedCurrencies: ["CHF", "EUR", "USD"],
        phoneCode: "+41",
        supportMobileMoney: false,
    },
    {
        code: "CA",
        name: "Canada",
        nameFr: "Canada",
        flag: "🇨🇦",
        defaultCurrency: "CAD",
        supportedCurrencies: ["CAD", "USD", "EUR"],
        phoneCode: "+1",
        supportMobileMoney: false,
    },
    {
        code: "US",
        name: "United States",
        nameFr: "États-Unis",
        flag: "🇺🇸",
        defaultCurrency: "USD",
        supportedCurrencies: ["USD", "EUR"],
        phoneCode: "+1",
        supportMobileMoney: false,
    },
    {
        code: "GB",
        name: "United Kingdom",
        nameFr: "Royaume-Uni",
        flag: "🇬🇧",
        defaultCurrency: "GBP",
        supportedCurrencies: ["GBP", "EUR", "USD"],
        phoneCode: "+44",
        supportMobileMoney: false,
    },
    {
        code: "OTHER",
        name: "Other Country",
        nameFr: "Autre pays",
        flag: "🌍",
        defaultCurrency: "EUR",
        supportedCurrencies: ["EUR", "USD", "XAF", "XOF"],
        phoneCode: "+",
        supportMobileMoney: false,
    },
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

    useEffect(() => {
        setMounted(true);
    }, []);

    const currentCountry =
        COUNTRIES.find((c) => c.code === selectedCountry) || COUNTRIES[0];

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
                                onClick={() => setIsOpen(false)}
                            />
                            <div
                                className={cn(
                                    "absolute z-50 top-full left-0 right-0 mt-2",
                                    "bg-surface border border-white/10 rounded-xl shadow-2xl",
                                    "max-h-[300px] overflow-y-auto custom-scrollbar"
                                )}
                            >
                                {COUNTRIES.map((country) => (
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
                                        }}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-4 py-3 text-left",
                                            "hover:bg-white/5 transition-colors",
                                            selectedCountry === country.code && "bg-primary/10"
                                        )}
                                    >
                                        <span className="text-xl">{country.flag}</span>
                                        <span className="font-medium text-text-main">
                                            {country.nameFr}
                                        </span>
                                        {selectedCountry === country.code && (
                                            <span className="ml-auto text-primary text-xs font-bold">
                                                ✓
                                            </span>
                                        )}
                                    </button>
                                ))}
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
