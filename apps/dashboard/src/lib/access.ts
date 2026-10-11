"use client";

/**
 * Permissions du membre connecté sur l'agrégateur (ADR-0018 D5.2). L'interface masque ce qu'il ne peut pas faire ;
 * le backend du PSP reste la seule garantie (chaque route exige sa permission).
 */
import { useSession } from "next-auth/react";

export type PspPermission = "psp.view" | "psp.providers.manage" | "psp.operations.manage" | "psp.companies.manage";

export const PERMISSION_LABELS: Record<PspPermission, string> = {
    "psp.view": "Consultation",
    "psp.providers.manage": "Prestataires et routage",
    "psp.operations.manage": "Opérations",
    "psp.companies.manage": "Entreprises",
};

export const ROLE_LABELS: Record<string, string> = {
    superadmin: "Super-administrateur", admin: "Administrateur", finance_manager: "Finances",
    course_validator: "Validation des contenus", staff: "Équipe", machine: "Intégration",
};

export function useAccess() {
    const { data, status } = useSession();
    const user = data?.user as { name?: string | null; email?: string | null; role?: string; permissions?: string[] } | undefined;
    const permissions = (user?.permissions ?? []) as PspPermission[];
    const can = (p: PspPermission) => permissions.includes(p);
    return { ready: status !== "loading", user, permissions, can, canAny: (ps: PspPermission[]) => ps.some(can) };
}
