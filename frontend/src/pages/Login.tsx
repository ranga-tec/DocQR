import { useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { authService } from "@/services/auth.service"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { QrCode, Lock, Mail, Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"

export function LoginPage() {
    const { login } = useAuth()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const { register, handleSubmit } = useForm()

    const onSubmit = async (data: any) => {
        setIsLoading(true)
        setError(null)
        console.log("Submitting login:", data); // Debug input
        try {
            const response = await authService.login({
                username: data.email, // Backend now accepts email as username field
                password: data.password
            })
            console.log("Login success:", response); // Debug log

            // Context login sets state
            login(response.token, response.user)

            // Navigate explicitly after successful login
            window.location.href = "/"; // Force navigation if router fails
        } catch (err: any) {
            console.error("Login failed:", err); // Debug log
            const errorMessage = err.response?.data?.error || err.message || "Login failed. Please check your credentials.";
            setError(errorMessage);
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-white [mask-image:linear-gradient(to_bottom,white,transparent)] pointer-events-none" />

            <Card className="w-full max-w-md border-neutral-200 shadow-xl relative z-10">
                <CardHeader className="space-y-1 text-center pb-8 border-b border-neutral-100 bg-neutral-50/50 rounded-t-lg">
                    <div className="mx-auto bg-primary text-primary-foreground p-3 rounded-xl w-12 h-12 flex items-center justify-center mb-4 ring-4 ring-primary/10">
                        <QrCode className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight text-neutral-900">
                        DOCQR Login
                    </CardTitle>
                    <CardDescription className="text-neutral-500">
                        Sign in to access secure documents
                    </CardDescription>
                </CardHeader>

                <form onSubmit={handleSubmit(onSubmit)}>
                    <CardContent className="space-y-4 pt-8 pb-8 px-8">
                        {error && (
                            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none text-neutral-700">Email or Username</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
                                <Input
                                    {...register("email", { required: true })}
                                    placeholder="admin@docqr.local"
                                    className="pl-10 h-11 border-neutral-200 bg-white focus:bg-white transition-colors"
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium leading-none text-neutral-700">Password</label>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
                                <Input
                                    {...register("password", { required: true })}
                                    type="password"
                                    placeholder="••••••••"
                                    className="pl-10 h-11 border-neutral-200 bg-white focus:bg-white transition-colors"
                                    autoComplete="current-password"
                                />
                            </div>
                            <div className="flex justify-end">
                                <a href="#" className="text-sm text-primary hover:text-primary/90 font-medium">Forgot password?</a>
                            </div>
                        </div>
                    </CardContent>

                    <CardFooter className="pb-8 px-8 flex flex-col gap-4">
                        <Button
                            type="submit"
                            className="w-full h-11 text-base shadow-sm font-semibold"
                            size="lg"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                "Sign In"
                            )}
                        </Button>

                        <div className="text-center text-sm text-neutral-500 pt-2">
                            Don't have an account? <a href="#" className="text-primary hover:underline font-medium">Contact Administrator</a>
                        </div>
                    </CardFooter>
                </form>
            </Card>

            <div className="absolute bottom-8 text-center text-xs text-neutral-400">
                &copy; {new Date().getFullYear()} DOCQR Secure.
            </div>
        </div>
    )
}
