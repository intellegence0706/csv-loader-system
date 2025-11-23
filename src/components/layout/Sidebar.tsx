import { Link, useLocation, useNavigate } from "react-router-dom";
import { Users, UserCircle2, LogOut, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/auth");
      toast({ title: "ログアウトしました" });
    } catch (error: any) {
      toast({
        title: "エラー",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const menuItems = [{ path: "/customers", icon: Users, label: "ネイリスト一覧" }];

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#f8b8b8] to-[#b7d8db] shadow-sm">
        <h1 className="text-white font-semibold text-lg">LOGO</h1>
        <button onClick={() => setOpen(!open)}>
          <Menu className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed md:static top-0 left-0 z-40 h-full md:h-auto transform transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          w-[250px] sm:w-[260px] md:w-[300px] flex flex-col justify-between
          bg-gradient-to-b from-[#f8b8b8] to-[#b7d8db] shadow-lg md:shadow-none`}
      >
        {/* Logo */}
        <div className="pt-8 pb-6 px-8 hidden md:block">
          <div className="bg-gray-300 rounded-sm py-3 text-center">
            <h1 className="text-white font-semibold text-base tracking-wide">
              LOGO
            </h1>
          </div>
        </div>

        <nav className="flex-1 px-6 md:px-8 space-y-3 mt-6 md:mt-0">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.path ||
              location.pathname.startsWith(item.path + "/");

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setOpen(false)} // close on mobile tap
                className={`flex items-center space-x-2 px-4 py-2 text-sm transition-all
                  ${
                    isActive
                      ? "bg-white text-[#0b7a7a] rounded-full shadow-sm"
                      : "text-white/90 hover:text-white"
                  }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? "text-[#0b7a7a]" : "text-white/90"
                  }`}
                />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

      
        <div className="border-t border-white/40 px-5 py-6 space-y-5">
         
          <div className="flex items-center space-x-3 text-white/90">
            <UserCircle2 className="w-6 h-6 opacity-90" />
            <div>
              <p className="text-xs font-medium text-white/90">
                ログイン中アカウント
              </p>
              <p className="text-[11px] text-white/80 tracking-wide">
                mail@gmail.com
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 text-white/90 hover:text-white/100 text-sm transition"
          >
            <LogOut className="w-5 h-5 opacity-90" />
            <span className="text-xs font-bold tracking-wide">
              ログアウト
            </span>
          </button>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 bg-black/30 md:hidden z-30"
          onClick={() => setOpen(false)}
        ></div>
      )}
    </>
  );
};

export default Sidebar;
