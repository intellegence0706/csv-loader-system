import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Sidebar from "@/components/layout/Sidebar";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Upload, Search } from "lucide-react";

interface Customer {
  id: string;
  external_id: string;
  name: string;
  status: string;
  age?: number;
  experience?: string;
  occupation?: string;
  prefecture?: string;
  created_at: string;
}

const Customers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    fetchCustomers();
  }, []);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) navigate("/auth");
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      toast({
        title: "エラー",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.external_id?.includes(searchQuery)
  );

  console.log(customers);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in_progress":
        return (
          <span className="px-3 py-1 text-xs rounded-md bg-[#E5F4F9] text-[#3FA9D9] border border-[#3FA9D9]">
            進捗中
          </span>
        );
      case "new":
        return (
          <span className="px-3 py-1 text-xs rounded-md bg-[#FCECEC] text-[#D9534F] border border-[#D9534F]">
            新規
          </span>
        );
      case "completed":
        return (
          <span className="px-3 py-1 text-xs rounded-md bg-[#EAF6EA] text-[#5CB85C] border border-[#5CB85C]">
            完了
          </span>
        );
      default:
        return status;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 p-6 sm:p-8 overflow-x-auto">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-700">
              ネイリスト一覧
            </h1>
            <Button
              onClick={() => navigate("/customers/import")}
              className="bg-[#16929f] hover:bg-[#68a9b7] text-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              CSVアップロード
            </Button>
          </div>

          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="名前またはIDで検索"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
          </div>

          <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-200 bg-white">
                  {[
                    "顧客番号",
                    "名前",
                    "ステータス",
                    "年齢",
                    "ネイリスト歴",
                    "職業",
                    "都道府県",
                    "申し込み日",
                  ].map((header) => (
                    <TableHead
                      key={header}
                      className="text-gray-400 font-semibold text-sm text-center py-4"
                    >
                      {header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-gray-400"
                    >
                      読み込み中...
                    </TableCell>
                  </TableRow>
                ) : filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-gray-400"
                    >
                      データがありません
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => (
                    <TableRow
                      key={customer.id}
                      className="hover:bg-gray-50 transition cursor-pointer"
                      onClick={() => navigate(`/customers/${customer.id}`)}
                    >
                      <TableCell className="font-medium text-gray-700 text-center">
                        {customer.external_id}
                      </TableCell>
                      <TableCell className="text-gray-700 text-center">
                        {customer.name}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(customer.status)}
                      </TableCell>
                      <TableCell className="text-gray-700 text-center">
                        {customer.age || "—"}
                      </TableCell>
                      <TableCell className="text-gray-700 text-center">
                        {customer.nailist_experience || "—"}
                      </TableCell>
                      <TableCell className="text-gray-700 text-center">
                        {customer.occupation_type === null ? "社員" : (customer.occupation_type || "—")}
                      </TableCell>
                      <TableCell className="text-gray-700 text-center">
                        {customer.prefecture || "—"}
                      </TableCell>
                      <TableCell className="text-gray-700 text-center">
                        {new Date(customer.created_at).toLocaleDateString(
                          "ja-JP"
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Customers;
