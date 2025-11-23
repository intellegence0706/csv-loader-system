import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/customers");
      }
    });
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/customers` },
        });
        if (error) throw error;

        toast({
          title: "アカウントが作成されました",
          description: "ログインしてください。",
        });
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        console.log(error);
        navigate("/customers");
      }
    } catch (error: any) {
      toast({
        title: "エラー",
        description: error.message || "認証に失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#f8b8b8] to-[#b7d8db]">
      <h1 className="text-white text-lg font-medium mb-6">基礎スキルチェック</h1>
      <div className="bg-white/90 w-full max-w-md px-10 py-8 rounded-sm shadow-md">
        <h2 className="text-center text-lg font-bold text-gray-800 mb-6">
          ログイン
        </h2>

        <form onSubmit={handleAuth} className="space-y-6">
          <div>
            <Label
              htmlFor="email"
              className="block text-sm text-gray-700 mb-1"
            >
              メールアドレス
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="mail@adress.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 bg-white px-3 py-2 text-sm rounded-none focus:outline-none focus:ring-1 focus:ring-teal-400"
            />
          </div>

          <div>
            <Label
              htmlFor="password"
              className="block text-sm text-gray-700 mb-1"
            >
              パスワード
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 bg-white px-3 py-2 text-sm rounded-none focus:outline-none focus:ring-1 focus:ring-teal-400"
            />
          </div>

          <div className="text-center">
            <Button
              type="submit"
              className="bg-[#16787a] hover:bg-[#126b6d] text-white text-sm font-semibold px-6 py-1.5 rounded-sm shadow-sm transition disabled:opacity-60"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  処理中...
                </>
              ) : isSignUp ? (
                "サインアップ"
              ) : (
                "ログイン"
              )}
            </Button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-[#16787a] hover:text-[#c46c82] hover:underline transition"
            >
              {/* {isSignUp
                ? "既にアカウントをお持ちの方"
                : "アカウントをお持ちでない方"} */}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Auth;
