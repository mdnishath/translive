"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AuthForm, { AuthFormData } from "@/components/ui/AuthForm";
import { useAuth } from "@/context/AuthContext";

export default function SignupPage() {
  const { signup, user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/chat");
  }, [user, loading, router]);

  const handleSignup = async (data: AuthFormData) => {
    const result = await signup({
      name: data.name!,
      email: data.email,
      password: data.password,
      language: data.language || "bn",
    });
    if (!result.error) router.push("/chat");
    return result;
  };

  return <AuthForm mode="signup" onSubmit={handleSignup} loading={loading} />;
}
