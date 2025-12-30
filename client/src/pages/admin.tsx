import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Wallet, RefreshCw, Download, DollarSign, Activity, Shield, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useToast } from "@/hooks/use-toast";
import { MEGAETH_RPC, USDM_ADDRESS, SWAP_ADDRESS, MEGAETH_CHAIN_ID } from "@/lib/contracts";

const OWNER_ADDRESS = "0x0315eCb53F64b7A4bA56bb8A4DAB0D96F0856b60".toLowerCase();

export default function AdminPage() {
  const [contractEthBalance, setContractEthBalance] = useState("0");
  const [contractUsdmBalance, setContractUsdmBalance] = useState("0");
  const [currentPrice, setCurrentPrice] = useState("0");
  const [newPrice, setNewPrice] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showBalances, setShowBalances] = useState(true);
  
  const { login, logout, authenticated, ready } = usePrivy();
  const { wallets } = useWallets();
  const activeWallet = wallets[0];
  const { toast } = useToast();

  const isOwner = activeWallet?.address?.toLowerCase() === OWNER_ADDRESS;

  const fetchContractData = async () => {
    try {
      // Fetch contract ETH balance
      const ethRes = await fetch(MEGAETH_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getBalance", params: [SWAP_ADDRESS, "latest"], id: 1 })
      });
      const ethData = await ethRes.json();
      if (ethData.result) {
        setContractEthBalance((parseInt(ethData.result, 16) / 1e18).toFixed(6));
      }

      // Fetch current price from contract
      const priceRes = await fetch(MEGAETH_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_call", params: [{ to: SWAP_ADDRESS, data: "0xc9f15756" }, "latest"], id: 2 })
      });
      const priceData = await priceRes.json();
      if (priceData.result && priceData.result !== "0x") {
        const price = parseInt(priceData.result, 16) / 1e8;
        setCurrentPrice(price.toFixed(2));
      }

      // Fetch USDM total supply
      const supplyRes = await fetch(MEGAETH_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_call", params: [{ to: USDM_ADDRESS, data: "0x18160ddd" }, "latest"], id: 3 })
      });
      const supplyData = await supplyRes.json();
      if (supplyData.result && supplyData.result !== "0x") {
        const supply = parseInt(supplyData.result, 16) / 1e6;
        setContractUsdmBalance(supply.toFixed(2));
      }
    } catch (e) {
      console.error("Failed to fetch contract data:", e);
    }
  };

  useEffect(() => {
    fetchContractData();
    const interval = setInterval(fetchContractData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleWithdrawAll = async () => {
    if (!activeWallet || !isOwner) return;
    setIsLoading(true);
    try {
      const provider = await activeWallet.getEthereumProvider();
      const tx = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: activeWallet.address,
          to: SWAP_ADDRESS,
          data: '0x90386bbf',
        }],
      });
      toast({ title: "Withdrawal Submitted", description: `Tx: ${(tx as string).slice(0, 20)}...` });
      setTimeout(fetchContractData, 5000);
    } catch (err: any) {
      toast({ title: "Withdrawal Failed", description: err.message, variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handleWithdrawAmount = async () => {
    if (!activeWallet || !isOwner || !withdrawAmount) return;
    setIsLoading(true);
    try {
      const provider = await activeWallet.getEthereumProvider();
      const amount = BigInt(Math.floor(parseFloat(withdrawAmount) * 1e18));
      const data = '0xf14210a6' + amount.toString(16).padStart(64, '0');
      const tx = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: activeWallet.address,
          to: SWAP_ADDRESS,
          data,
        }],
      });
      toast({ title: "Withdrawal Submitted", description: `Tx: ${(tx as string).slice(0, 20)}...` });
      setWithdrawAmount("");
      setTimeout(fetchContractData, 5000);
    } catch (err: any) {
      toast({ title: "Withdrawal Failed", description: err.message, variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handleUpdatePrice = async () => {
    if (!activeWallet || !isOwner || !newPrice) return;
    setIsLoading(true);
    try {
      const provider = await activeWallet.getEthereumProvider();
      const price = BigInt(Math.floor(parseFloat(newPrice) * 1e8));
      const data = '0xd7a71868' + price.toString(16).padStart(64, '0');
      const tx = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: activeWallet.address,
          to: SWAP_ADDRESS,
          data,
        }],
      });
      toast({ title: "Price Update Submitted", description: `New price: $${newPrice}` });
      setNewPrice("");
      setTimeout(fetchContractData, 5000);
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handleEmergencyWithdraw = async () => {
    if (!activeWallet || !isOwner) return;
    setIsLoading(true);
    try {
      const provider = await activeWallet.getEthereumProvider();
      const tx = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: activeWallet.address,
          to: SWAP_ADDRESS,
          data: '0xdb2e21bc', // emergencyWithdraw()
        }],
      });
      toast({ title: "Emergency Withdrawal Submitted" });
      setTimeout(fetchContractData, 5000);
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
    setIsLoading(false);
  };

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="w-12 h-12 border-2 border-[#d4c4a8] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <Shield className="w-16 h-16 text-[#d4c4a8] mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-4">Admin Access Required</h1>
          <Button onClick={login} className="bg-[#d4c4a8] hover:bg-[#c4b498] text-[#0a0a0a] font-semibold">
            <Wallet className="w-4 h-4 mr-2" />Connect Wallet
          </Button>
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-neutral-500">Only the contract owner can access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-[#d4c4a8]" />
            <div>
              <h1 className="text-2xl font-bold">Admin Panel</h1>
              <p className="text-sm text-neutral-500">MegaSwap Contract Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowBalances(!showBalances)} variant="ghost" size="sm">
              {showBalances ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button onClick={fetchContractData} variant="ghost" size="sm">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button onClick={logout} variant="outline" size="sm" className="border-neutral-700">
              Disconnect
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-neutral-900 rounded-xl p-4 border border-neutral-800"
          >
            <div className="text-sm text-neutral-500 mb-1">Contract ETH Balance</div>
            <div className="text-2xl font-bold text-[#d4c4a8]">
              {showBalances ? `${contractEthBalance} ETH` : "••••••"}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-neutral-900 rounded-xl p-4 border border-neutral-800"
          >
            <div className="text-sm text-neutral-500 mb-1">USDM Total Supply</div>
            <div className="text-2xl font-bold text-white">
              {showBalances ? `${contractUsdmBalance} USDM` : "••••••"}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-neutral-900 rounded-xl p-4 border border-neutral-800"
          >
            <div className="text-sm text-neutral-500 mb-1">Current ETH Price</div>
            <div className="text-2xl font-bold text-green-400">${currentPrice}</div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-neutral-900 rounded-xl p-6 border border-neutral-800"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-[#d4c4a8]" />
              Withdraw ETH
            </h2>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Amount in ETH"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="bg-neutral-800 border-neutral-700"
                />
                <Button 
                  onClick={handleWithdrawAmount}
                  disabled={isLoading || !withdrawAmount}
                  className="bg-[#d4c4a8] hover:bg-[#c4b498] text-[#0a0a0a]"
                >
                  Withdraw
                </Button>
              </div>
              <Button 
                onClick={handleWithdrawAll}
                disabled={isLoading}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Withdraw All ETH
              </Button>
              <Button 
                onClick={handleEmergencyWithdraw}
                disabled={isLoading}
                variant="destructive"
                className="w-full"
              >
                Emergency Withdraw
              </Button>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-neutral-900 rounded-xl p-6 border border-neutral-800"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#d4c4a8]" />
              Update Price
            </h2>
            <div className="space-y-3">
              <div className="text-sm text-neutral-500">
                Current: <span className="text-white">${currentPrice}</span>
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="New price in USD"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="bg-neutral-800 border-neutral-700"
                />
                <Button 
                  onClick={handleUpdatePrice}
                  disabled={isLoading || !newPrice}
                  className="bg-[#d4c4a8] hover:bg-[#c4b498] text-[#0a0a0a]"
                >
                  Update
                </Button>
              </div>
              <p className="text-xs text-neutral-600">
                Tip: Use the price updater script for automatic updates
              </p>
            </div>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 p-4 bg-neutral-900/50 rounded-xl border border-neutral-800"
        >
          <h3 className="text-sm font-semibold text-neutral-400 mb-2">Contract Addresses</h3>
          <div className="space-y-1 text-xs font-mono text-neutral-500">
            <div>USDM: {USDM_ADDRESS}</div>
            <div>Swap: {SWAP_ADDRESS}</div>
            <div>Owner: {OWNER_ADDRESS}</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
