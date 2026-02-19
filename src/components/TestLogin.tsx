import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Testovací přihlašovací komponenta
 * Strukturovaný layout s jasným rozdělením responsibilit
 */
export const TestLogin = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleToggle = () => {
    setIsLogin(!isLogin);
    setMessage(null);
    setEmail("");
    setPassword("");
    setDisplayName("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // Simulace přihlášení/registrace (test)
    setTimeout(() => {
      if (isLogin) {
        setMessage({
          text: `✅ Přihlášení úspěšné! Email: ${email}`,
          type: "success",
        });
      } else {
        setMessage({
          text: `✅ Registrace úspěšná! Vítejte, ${displayName || "Uživatel"}!`,
          type: "success",
        });
      }
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
      <Card className="w-full max-w-md">
        {/* Header Section */}
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            🤖 M.A.R.K. / V.E.R.A.
          </CardTitle>
          <CardDescription>
            {isLogin ? "Přihlaste se k vašemu asistentovi" : "Vytvořte si nový účet"}
          </CardDescription>
        </CardHeader>

        {/* Form Section */}
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Field - pouze při registraci */}
            {!isLogin && (
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Jméno
                </label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Vaše jméno"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="vas@email.cz"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Heslo
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* Submit Button */}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Načítání..." : isLogin ? "Přihlásit se" : "Registrovat"}
            </Button>
          </form>

          {/* Message Display */}
          {message && (
            <div
              className={`mt-4 p-3 rounded-lg text-sm text-center ${
                message.type === "success"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Toggle Link */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <span>{isLogin ? "Nemáte účet? " : "Již máte účet? "}</span>
            <button
              type="button"
              onClick={handleToggle}
              className="text-primary hover:underline font-medium"
            >
              {isLogin ? "Registrujte se" : "Přihlaste se"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
