"use client";

import React, { useEffect, useState } from "react";
import {
    X,
    Plus,
    Minus,
    Loader2,
    CreditCard,
    Smartphone,
    Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { b2bPackages } from "@/lib/api";
import { toast } from "sonner";
import { CountryCurrencySelector, COUNTRIES, type CountryConfig } from "@/components/ui/CountryCurrencySelector";

interface AddLicenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    packageData: {
        id: number;
        name: string;
        title: string;
        total_licenses: number;
        used_licenses: number;
        price?: number;
        currency?: string;
    } | null;
}

export function AddLicenseModal({ isOpen, onClose, packageData }: AddLicenseModalProps) {
    const [mounted, setMounted] = useState(false);
    const [licenseCount, setLicenseCount] = useState(5);
    const [displayCurrency, setDisplayCurrency] = useState<"XAF" | "EUR" | "USD">("XAF");
    const [selectedCountry, setSelectedCountry] = useState("CM");
    const [paymentMethod, setPaymentMethod] = useState<"card" | "mobile_money">("card");

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    const addLicensesMutation = useMutation({
        mutationFn: (data: { additional_licenses: number; currency: string; countryCode?: string; paymentMethod?: string }) =>
            b2bPackages.addLicenses(packageData?.id || 0, data),
        onSuccess: (response) => {
            const { redirectUrl, paymentUrl } = response.data.data || {};
            const url = redirectUrl || paymentUrl;

            if (url) {
                window.location.href = url;
            } else {
                toast.success("Licences ajoutées avec succès!");
                onClose();
            }
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || "Erreur lors de l'ajout de licences");
        }
    });

    if (!mounted || !isOpen || !packageData) return null;

    const basePrice = packageData.price || 0;
    const currentLicenses = packageData.total_licenses;
    const usedLicenses = packageData.used_licenses;

    // Extended conversion rates (to EUR as base)
    const ratesToEUR: Record<string, number> = {
        XAF: 655.957,    // CFA Franc BEAC
        XOF: 655.957,    // CFA Franc BCEAO
        EUR: 1,
        USD: 1.08,
        GBP: 0.856,
        CHF: 0.942,
        CAD: 1.465,
        JPY: 162.45,
        CNY: 7.85,
        KRW: 1462.5,
        INR: 90.25,
        BRL: 5.42,
        MXN: 18.45,
        ZAR: 20.85,
        NGN: 890.5,
        GHS: 12.85,
        KES: 164.5,
        MAD: 10.85,
        TND: 3.42,
        EGP: 33.25,
        AED: 3.97,
        SAR: 4.05,
        QAR: 3.94,
        KWD: 0.334,
        BHD: 0.407,
        OMR: 0.416,
        // Add more as needed
    };

    const convertPrice = (price: number, from: string, to: string) => {
        // If same currency, no conversion needed
        if (from === to) return price;
        
        // Get rate to EUR (base), default to 1 if unknown
        const fromRate = ratesToEUR[from] || 1;
        const toRate = ratesToEUR[to] || 1;
        
        // Convert: price -> EUR -> target currency
        const priceInEur = price / fromRate;
        return priceInEur * toRate;
    };

    const unitPrice = convertPrice(basePrice, packageData.currency || "EUR", displayCurrency);
    const totalPrice = unitPrice * licenseCount;

    // Get current country config
    const currentCountry = COUNTRIES.find(c => c.code === selectedCountry) || COUNTRIES[0];

    const handlePurchase = () => {
        addLicensesMutation.mutate({
            additional_licenses: licenseCount,
            currency: displayCurrency,
            countryCode: selectedCountry,
            paymentMethod
        });
    };

    const newTotal = currentLicenses + licenseCount;
    const newAvailable = newTotal - usedLicenses;

    return (
        <>
            {/* Backdrop - full viewport coverage with highest z-index to cover sidebar and header */}
            <div
                className="fixed inset-0 z-[9999] bg-background/90 backdrop-blur-3xl transition-all duration-300"
                onClick={onClose}
            />

            {/* Modal - properly centered with max-height for scrollability */}
            <div
                className={cn(
                    "fixed z-[10000] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] sm:w-[90%] max-w-md bg-surface rounded-2xl border border-white/10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] overflow-hidden transition-all duration-300",
                    isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-surface/40 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
                            <Zap className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-text-main">
                                Ajouter des licences
                            </h2>
                            <p className="text-xs text-text-muted">{packageData.title || packageData.name}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 rounded-lg bg-white/5 text-text-muted hover:text-white hover:bg-error/20 flex items-center justify-center transition-all"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body - scrollable with max-height */}
                <div className="p-5 space-y-5 overflow-y-auto max-h-[60vh] custom-scrollbar">
                    {/* Current Status */}
                    <div className="card bg-white/[0.02] border-white/5">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-text-muted">Licences actuelles</span>
                            <span className="font-bold text-text-main">{currentLicenses}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mt-2">
                            <span className="text-text-muted">Utilisées</span>
                            <span className="font-bold text-warning">{usedLicenses}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mt-2">
                            <span className="text-text-muted">Disponibles</span>
                            <span className="font-bold text-success">{currentLicenses - usedLicenses}</span>
                        </div>
                    </div>

                    {/* License Selection */}
                    <div>
                        <label className="text-sm font-medium text-text-main block mb-3">
                            Nombre de licences à ajouter
                        </label>
                        <div className="flex items-center justify-center gap-4">
                            <button
                                onClick={() => setLicenseCount(Math.max(1, licenseCount - 1))}
                                className="h-12 w-12 rounded-xl bg-background flex items-center justify-center text-text-muted hover:text-text-main hover:bg-white/5 transition-all"
                            >
                                <Minus className="h-5 w-5" />
                            </button>
                            <div className="text-4xl font-black text-text-main w-24 text-center">
                                {licenseCount}
                            </div>
                            <button
                                onClick={() => setLicenseCount(licenseCount + 1)}
                                className="h-12 w-12 rounded-xl bg-background flex items-center justify-center text-text-muted hover:text-text-main hover:bg-white/5 transition-all"
                            >
                                <Plus className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Quick Select */}
                        <div className="flex gap-2 mt-4 justify-center">
                            {[5, 10, 25, 50].map((num) => (
                                <button
                                    key={num}
                                    onClick={() => setLicenseCount(num)}
                                    className={cn(
                                        "text-xs font-bold px-3 py-1.5 rounded-lg transition-all",
                                        licenseCount === num
                                            ? "bg-primary text-white"
                                            : "bg-white/5 text-text-muted hover:bg-white/10"
                                    )}
                                >
                                    +{num}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Country & Currency Selection */}
                    <CountryCurrencySelector
                        selectedCountry={selectedCountry}
                        selectedCurrency={displayCurrency}
                        onCountryChange={(country: CountryConfig) => {
                            setSelectedCountry(country.code);
                            setDisplayCurrency(country.defaultCurrency as "XAF" | "EUR" | "USD");
                            // Reset payment method when country changes if MM not supported
                            if (!country.supportMobileMoney && paymentMethod === "mobile_money") {
                                setPaymentMethod("card");
                            }
                        }}
                        onCurrencyChange={(curr) => setDisplayCurrency(curr as "XAF" | "EUR" | "USD")}
                    />

                    {/* Payment Method Selection */}
                    <div>
                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-2">
                            Mode de paiement
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setPaymentMethod("card")}
                                className={cn(
                                    "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                                    paymentMethod === "card"
                                        ? "bg-primary/10 border-primary text-primary"
                                        : "bg-white/5 border-white/10 text-text-muted hover:bg-white/10"
                                )}
                            >
                                <CreditCard className="h-6 w-6" />
                                <span className="text-xs font-bold">Carte</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!currentCountry.supportMobileMoney) {
                                        toast.error(
                                            `Le Mobile Money n'est pas disponible pour ${currentCountry.nameFr}. Veuillez choisir le paiement par carte.`
                                        );
                                        return;
                                    }
                                    setPaymentMethod("mobile_money");
                                }}
                                disabled={!currentCountry.supportMobileMoney}
                                className={cn(
                                    "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                                    paymentMethod === "mobile_money"
                                        ? "bg-primary/10 border-primary text-primary"
                                        : currentCountry.supportMobileMoney
                                            ? "bg-white/5 border-white/10 text-text-muted hover:bg-white/10"
                                            : "bg-white/5 border-white/5 text-text-muted/50 cursor-not-allowed"
                                )}
                            >
                                <Smartphone className="h-6 w-6" />
                                <span className="text-xs font-bold">Mobile Money</span>
                            </button>
                        </div>
                        {paymentMethod === "card" ? (
                            <p className="text-[10px] text-text-muted mt-2 flex items-center gap-1">
                                <CreditCard className="h-3 w-3" />
                                Paiement sécurisé par Stripe (Visa, Mastercard)
                            </p>
                        ) : currentCountry.supportMobileMoney ? (
                            <p className="text-[10px] text-success mt-2 flex items-center gap-1">
                                <Smartphone className="h-3 w-3" />
                                {currentCountry.mobileMoneyProviders?.join(", ")} disponibles pour {currentCountry.nameFr}
                            </p>
                        ) : null}
                    </div>

                    {/* Price Summary */}
                    <div className="card bg-primary/[0.05] border-primary/20">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-text-muted">Prix unitaire</span>
                            <span className="text-text-main">{unitPrice.toLocaleString()} {displayCurrency}</span>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-text-muted">Licences</span>
                            <span className="text-text-main">× {licenseCount}</span>
                        </div>
                        <div className="flex justify-between pt-3 border-t border-primary/20">
                            <span className="font-bold text-text-main">Total à payer</span>
                            <span className="text-2xl font-black text-primary">
                                {totalPrice.toLocaleString()} {displayCurrency}
                            </span>
                        </div>
                    </div>

                    {/* After Purchase Preview */}
                    <div className="text-center p-3 rounded-xl bg-success/10 border border-success/20">
                        <p className="text-xs font-bold text-success mb-1">Après l'achat</p>
                        <p className="text-sm text-text-main">
                            <span className="font-bold">{newTotal}</span> licences totales,
                            <span className="font-bold text-success"> {newAvailable}</span> disponibles
                        </p>
                    </div>
                </div>

                {/* Footer - shrink to bottom */}
                <div className="px-5 py-4 border-t border-white/5 shrink-0">
                    <button
                        onClick={handlePurchase}
                        disabled={addLicensesMutation.isPending || licenseCount < 1}
                        className="btn btn-primary w-full h-12"
                    >
                        {addLicensesMutation.isPending ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <>
                                <CreditCard className="h-5 w-5" />
                                Payer {totalPrice.toLocaleString()} {displayCurrency}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </>
    );
}
