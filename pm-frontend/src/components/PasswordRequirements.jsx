import { CheckCircle2, XCircle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { validatePassword } from "@/lib/passwordValidation";

export default function PasswordRequirements({ password }) {
  const validation = validatePassword(password);

  const requirements = [
    { key: "minLength", label: "At least 8 characters" },
    { key: "hasUpperCase", label: "At least one uppercase letter (A-Z)" },
    { key: "hasLowerCase", label: "At least one lowercase letter (a-z)" },
    { key: "hasNumber", label: "At least one number (0-9)" },
    {
      key: "hasSpecialChar",
      label: "At least one special character (!@#$%^&*...)",
    },
  ];

  return (
    <Alert className="mt-2">
      <Info className="h-4 w-4" />
      <AlertDescription>
        <p className="font-medium mb-2">Password must contain:</p>
        <ul className="space-y-1 text-sm">
          {requirements.map(({ key, label }) => (
            <li key={key} className="flex items-center gap-2">
              {validation[key] ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              {label}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
