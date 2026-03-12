"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AuthForm, { AuthFormData } from "@/components/ui/AuthForm";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/chat");
  }, [user, loading, router]);

  const handleLogin = async (data: AuthFormData) => {
    const result = await login(data.email, data.password);
    if (!result.error) router.push("/chat");
    return result;
  };

  return <AuthForm mode="login" onSubmit={handleLogin} loading={loading} />;
}
