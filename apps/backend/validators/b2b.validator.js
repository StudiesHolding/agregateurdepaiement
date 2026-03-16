import { z } from "zod";

// --- Auth Validations ---
export const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Le mot de passe doit faire au moins 6 caractères"),
});

// --- Employee Validations ---
export const employeeSchema = z.object({
  first_name: z.string().min(1, "Le prénom est requis"),
  last_name: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Email invalide"),
  department: z.string().optional(),
  position: z.string().optional(),
});

// --- License Assignment Validations ---
export const assignLicenseSchema = z.object({
  employee_id: z.number().int().positive(),
  company_package_id: z.number().int().positive(),
});

// --- Request Status Validations ---
export const updateRequestStatusSchema = z.object({
  status: z.enum(["pending", "processing", "activated", "rejected"]),
  admin_notes: z.string().optional(),
});
