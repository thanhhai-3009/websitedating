import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { motion } from "framer-motion";
import { 
  TrendingUp, 
  Download, 
  Calendar, 
  BarChart3, 
  PieChart, 
  ChevronRight,
  DollarSign,
  ArrowUpRight,
  FileSpreadsheet
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from "recharts";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/layout/Navbar";
import { getApiToken } from "@/lib/clerkToken";
import { useToast } from "@/hooks/use-toast";

interface RevenueData {
  period: string;
  totalRevenue: number;
  transactionCount: number;
}

const ManagerRevenue = () => {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<RevenueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodType, setPeriodType] = useState("MONTH");

  const fetchData = async (type: string) => {
    setLoading(true);
    try {
      const token = await getApiToken(getToken);
      const response = await fetch(`http://localhost:8080/api/revenue/stats?type=${type}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch data");
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error(error);
      toast({
        title: "Data Loading Error",
        description: "Could not fetch revenue information. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(periodType);
  }, [periodType]);

  const handleExport = async () => {
    try {
      const token = await getApiToken(getToken);
      const response = await fetch(`http://localhost:8080/api/revenue/export?type=${periodType}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `doanh_thu_${periodType.toLowerCase()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Successful",
        description: `Revenue report (${periodType.toLowerCase()}) has been downloaded.`
      });
    } catch (error) {
      toast({
        title: "Export Error",
        description: "Could not generate .csv file. Please try again.",
        variant: "destructive"
      });
    }
  };

  const totalRevenue = data.reduce((sum, item) => sum + item.totalRevenue, 0);
  const totalTransactions = data.reduce((sum, item) => sum + item.transactionCount, 0);

  return (
    <div className="min-h-screen bg-[#f8fafc] pt-24 pb-12">
      <Navbar isAuthenticated={true} />
      
      <main className="container mx-auto px-4 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
              <TrendingUp className="w-10 h-10 text-[#ff416c]" />
              Revenue Statistics
            </h1>
            <p className="text-slate-500 mt-2 text-lg">
              Monitor and analyze the system's business performance.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Button 
              onClick={handleExport}
              disabled={loading || data.length === 0}
              className="gradient-primary text-white rounded-2xl px-8 h-12 font-bold shadow-lg shadow-red-200 hover:scale-105 transition-all flex gap-2"
            >
              <FileSpreadsheet className="w-5 h-5" />
              Export .csv
            </Button>
          </motion.div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <StatCard 
            title="Total Revenue" 
            value={`${totalRevenue.toLocaleString("vi-VN")} VND`}
            icon={DollarSign}
            color="bg-emerald-50 text-emerald-600"
            trend="+12.5%"
          />
          <StatCard 
            title="Total Transactions" 
            value={totalTransactions.toLocaleString("vi-VN")}
            icon={BarChart3}
            color="bg-blue-50 text-blue-600"
            trend="+8.2%"
          />
          <StatCard 
            title="Average Value" 
            value={`${(totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0).toLocaleString("vi-VN")} VND`}
            icon={PieChart}
            color="bg-violet-50 text-violet-600"
            trend="+4.1%"
          />
        </div>

        <Tabs defaultValue="MONTH" onValueChange={setPeriodType} className="space-y-8">
          <div className="flex items-center justify-between">
            <TabsList className="bg-white p-1 rounded-2xl border border-slate-200 shadow-sm h-12">
              <TabsTrigger value="MONTH" className="rounded-xl px-6 font-bold data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all">Month</TabsTrigger>
              <TabsTrigger value="QUARTER" className="rounded-xl px-6 font-bold data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all">Quarter</TabsTrigger>
              <TabsTrigger value="YEAR" className="rounded-xl px-6 font-bold data-[state=active]:bg-slate-900 data-[state=active]:text-white transition-all">Year</TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
              <Calendar className="w-4 h-4" />
              Data until {new Date().toLocaleDateString("en-US")}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Chart Column */}
            <Card className="lg:col-span-2 border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-bold">Trend Chart</CardTitle>
                <CardDescription>Revenue fluctuations over time</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px] pt-4">
                {loading ? (
                   <div className="w-full h-full flex items-center justify-center">
                     <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#ff416c] border-t-transparent"></div>
                   </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={[...data].reverse()}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ff416c" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#ff416c" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="period" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#64748b', fontSize: 12}} 
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#64748b', fontSize: 12}}
                        tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          borderRadius: '16px', 
                          border: 'none', 
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                        }}
                        formatter={(value: any) => [`${value.toLocaleString("en-US")} VND`, "Revenue"]}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="totalRevenue" 
                        stroke="#ff416c" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorRev)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Table Column */}
            <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white">
              <CardHeader>
                <CardTitle className="text-xl font-bold">Data Details</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-y border-slate-100">
                      <tr>
                        <th className="text-left py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Period</th>
                        <th className="text-right py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2 font-semibold text-slate-700">
                              {item.period}
                              <ChevronRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right">
                             <span className="font-bold text-slate-900">{item.totalRevenue.toLocaleString("en-US")} đ</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </Tabs>
      </main>
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: string;
  icon: any;
  color: string;
  trend: string;
}

const StatCard = ({ title, value, icon: Icon, color, trend }: StatCardProps) => (
  <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl bg-white overflow-hidden group">
    <CardContent className="p-6">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${color} transition-transform group-hover:scale-110 duration-300`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex items-center gap-1 text-emerald-500 font-bold text-sm bg-emerald-50 px-2 py-1 rounded-lg">
          <ArrowUpRight className="w-4 h-4" />
          {trend}
        </div>
      </div>
      <div>
        <h3 className="text-slate-500 font-medium">{title}</h3>
        <p className="text-2xl font-black text-slate-900 mt-1">{value}</p>
      </div>
    </CardContent>
  </Card>
);

export default ManagerRevenue;
