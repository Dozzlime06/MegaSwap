import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpDown, Wallet, Activity, Check, Zap, BookOpen, RefreshCw, ChevronDown, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useToast } from "@/hooks/use-toast";
import megaswapLogo from "@assets/generated_images/megaswap_m_logo_beige.png";
import { MEGAETH_RPC, USDM_ADDRESS, SWAP_ADDRESS, MEGAETH_CHAIN_ID } from "@/lib/contracts";

export default function SwapPage() {
  const [amount, setAmount] = useState("");
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapSuccess, setSwapSuccess] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [ethPrice, setEthPrice] = useState<number>(3008);
  const [priceChange, setPriceChange] = useState<number>(2.3);
  const [priceLoading, setPriceLoading] = useState(false);
  const [ethBalance, setEthBalance] = useState("0");
  const [usdmBalance, setUsdmBalance] = useState("0");
  const [isEthToUsdm, setIsEthToUsdm] = useState(true);
  const [showTokenModal, setShowTokenModal] = useState<'from' | 'to' | null>(null);
  
  const { login, logout, authenticated, ready } = usePrivy();
  const { wallets } = useWallets();
  const activeWallet = wallets[0];
  const { toast } = useToast();

  const fetchETHPrice = async () => {
    setPriceLoading(true);
    try {
      const response = await fetch('/api/swap/price');
      const data = await response.json();
      if (data.eth) {
        setEthPrice(data.eth);
      }
    } catch (e) {
      console.error('Failed to fetch price:', e);
      // Fallback to CoinGecko
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true');
        const data = await response.json();
        setEthPrice(data.ethereum.usd);
        setPriceChange(data.ethereum.usd_24h_change || 0);
      } catch {}
    }
    setPriceLoading(false);
  };

  useEffect(() => {
    fetchETHPrice();
    const interval = setInterval(fetchETHPrice, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchBalances = async () => {
      if (!activeWallet?.address) return;
      try {
        // Fetch ETH balance
        const ethRes = await fetch(MEGAETH_RPC, { 
          method: "POST", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getBalance", params: [activeWallet.address, "latest"], id: 1 }) 
        });
        const ethData = await ethRes.json();
        setEthBalance(ethData.result ? (parseInt(ethData.result, 16) / 1e18).toFixed(4) : "0");
        
        // Fetch USDM balance (6 decimals)
        const balanceOfData = "0x70a08231000000000000000000000000" + activeWallet.address.slice(2).toLowerCase();
        const usdmRes = await fetch(MEGAETH_RPC, { 
          method: "POST", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify({ jsonrpc: "2.0", method: "eth_call", params: [{ to: USDM_ADDRESS, data: balanceOfData }, "latest"], id: 2 }) 
        });
        const usdmData = await usdmRes.json();
        if (usdmData.result && usdmData.result !== "0x") {
          const balance = parseInt(usdmData.result, 16) / 1e6;
          setUsdmBalance(balance.toFixed(2));
        }
      } catch { setEthBalance("0"); setUsdmBalance("0"); }
    };
    if (authenticated && activeWallet) { 
      fetchBalances(); 
      const interval = setInterval(fetchBalances, 15000); 
      return () => clearInterval(interval); 
    }
  }, [authenticated, activeWallet?.address]);

  const calculateOutput = () => {
    const inputAmount = parseFloat(amount) || 0;
    if (inputAmount <= 0) return "0.00";
    
    if (isEthToUsdm) {
      const usdmOut = inputAmount * ethPrice * 0.997;
      return usdmOut.toFixed(2);
    } else {
      const ethOut = (inputAmount / ethPrice) * 0.997;
      return ethOut.toFixed(6);
    }
  };

  const handleSwap = async () => {
    if (!amount || !authenticated || !activeWallet) return;
    const amountNum = parseFloat(amount);
    if (amountNum <= 0) { toast({ title: "Invalid Amount", variant: "destructive" }); return; }

    setIsSwapping(true); setSwapSuccess(false); setTxHash(null);
    try {
      // Use window.ethereum directly for better mobile compatibility
      const provider = (window as any).ethereum || await activeWallet.getEthereumProvider();
      const fromAddress = activeWallet?.address || await provider.request({ method: 'eth_accounts' }).then((a: string[]) => a[0]);
      
      // Check if on correct chain
      const chainId = await provider.request({ method: 'eth_chainId' });
      if (parseInt(chainId as string, 16) !== MEGAETH_CHAIN_ID) {
        // Switch to MegaETH
        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x' + MEGAETH_CHAIN_ID.toString(16) }],
          });
        } catch (switchError: any) {
          // Chain not added, add it
          if (switchError.code === 4902) {
            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x' + MEGAETH_CHAIN_ID.toString(16),
                chainName: 'MegaETH Mainnet',
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                rpcUrls: [MEGAETH_RPC],
                blockExplorerUrls: ['https://megaeth.blockscout.com'],
              }],
            });
          }
        }
      }

      if (isEthToUsdm) {
        // ETH -> USDM: Call swapETHForUSDM() with ETH value
        const ethValue = BigInt(Math.floor(amountNum * 1e18));
        const tx = await provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: fromAddress,
            to: SWAP_ADDRESS,
            value: '0x' + ethValue.toString(16),
            data: '0x24b646b3',
            gas: '0x30000'
          }],
        });
        setTxHash(tx as string);
      } else {
        // USDM -> ETH: First approve, then call swapUSDMForETH(amount)
        const usdmAmount = BigInt(Math.floor(amountNum * 1e6));
        
        // Approve USDM
        const approveData = '0x095ea7b3' + 
          SWAP_ADDRESS.slice(2).padStart(64, '0') + 
          usdmAmount.toString(16).padStart(64, '0');
        
        await provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: fromAddress,
            to: USDM_ADDRESS,
            data: approveData,
          }],
        });
        
        // Wait a bit for approval to confirm
        await new Promise(r => setTimeout(r, 3000));
        
        // Swap USDM for ETH
        const swapData = '0x3460b9a6' + usdmAmount.toString(16).padStart(64, '0');
        const tx = await provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: fromAddress,
            to: SWAP_ADDRESS,
            data: swapData,
          }],
        });
        setTxHash(tx as string);
      }
      
      setSwapSuccess(true); 
      setAmount(""); 
      toast({ title: "Swap Successful!" });
    } catch (err: any) { 
      console.error('Swap error:', err);
      toast({ title: "Swap Failed", description: err.message || "Transaction rejected", variant: "destructive" }); 
    }
    finally { setIsSwapping(false); }
  };

  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="relative">
        <div className="w-12 h-12 border-2 border-neutral-700 rounded-full" />
        <div className="absolute inset-0 w-12 h-12 border-2 border-[#d4c4a8] border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] text-white overflow-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-neutral-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={megaswapLogo} alt="MegaSwap" className="w-10 h-10 rounded-full" />
            <div>
              <span className="font-bold text-xl text-white">MegaSwap</span>
              <div className="text-[10px] text-neutral-500 tracking-widest uppercase">MegaETH Exchange</div>
            </div>
          </div>
          {authenticated && activeWallet ? (
            <Button onClick={logout} variant="outline" className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-white cursor-pointer" data-testid="button-disconnect-wallet">
              <Wallet className="w-4 h-4 mr-2" />{shortenAddress(activeWallet.address)}
            </Button>
          ) : (
            <Button onClick={login} className="bg-[#d4c4a8] hover:bg-[#c4b498] text-[#0a0a0a] font-semibold cursor-pointer" data-testid="button-connect-wallet">
              <Wallet className="w-4 h-4 mr-2" />Connect
            </Button>
          )}
        </div>
      </nav>

      <main className="relative min-h-screen flex items-center justify-center px-4 pt-20 pb-8">
        <div className="w-full max-w-md">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-6"
          >
            <h1 className="text-3xl font-bold mb-2 text-white">Swap on MegaETH</h1>
          </motion.div>

          {authenticated && activeWallet && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="grid grid-cols-2 gap-3 mb-4"
            >
              <div className="bg-neutral-900 rounded-xl p-3 border border-neutral-800">
                <div className="flex items-center gap-2 mb-1 text-xs text-neutral-500">
                  <img src="https://assets.coingecko.com/coins/images/279/small/ethereum.png" className="w-4 h-4 rounded-full" alt="ETH" />
                  ETH Balance
                </div>
                <div className="text-lg font-bold text-white" data-testid="text-eth-balance">{ethBalance} ETH</div>
              </div>
              <div className="bg-neutral-900 rounded-xl p-3 border border-neutral-800">
                <div className="flex items-center gap-2 mb-1 text-xs text-neutral-500">
                  <div className="w-4 h-4 rounded-full bg-[#d4c4a8] flex items-center justify-center text-[#0a0a0a] font-bold text-[8px]">$</div>
                  USDM Balance
                </div>
                <div className="text-lg font-bold text-white" data-testid="text-usdm-balance">{usdmBalance} USDM</div>
              </div>
            </motion.div>
          )}

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden"
          >
            <div className="p-4 space-y-3">
              <div className="bg-neutral-800/50 rounded-xl p-3 border border-neutral-700/50">
                <div className="flex justify-between text-xs text-neutral-500 mb-2">
                  <span>You Pay</span>
                  <span>Balance: {isEthToUsdm ? ethBalance : usdmBalance}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowTokenModal('from')}
                    className="flex items-center gap-1.5 bg-neutral-800 px-3 py-2 rounded-lg border border-neutral-700 hover:bg-neutral-700 transition-colors cursor-pointer"
                    data-testid="button-select-from-token"
                  >
                    {isEthToUsdm ? (
                      <img src="https://assets.coingecko.com/coins/images/279/small/ethereum.png" className="w-5 h-5 rounded-full" alt="ETH" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-[#d4c4a8] flex items-center justify-center text-[#0a0a0a] font-bold text-[10px]">$</div>
                    )}
                    <span className="font-medium text-sm text-white">{isEthToUsdm ? 'ETH' : 'USDM'}</span>
                    <ChevronDown className="w-4 h-4 text-neutral-400" />
                  </button>
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg text-right text-xl font-bold focus-visible:ring-1 focus-visible:ring-[#d4c4a8] text-white placeholder:text-neutral-600 h-9 px-3" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    data-testid="input-amount" 
                  />
                </div>
                {amount && parseFloat(amount) > 0 && (
                  <div className="text-xs text-neutral-500 mt-2 text-right">
                    ≈ ${isEthToUsdm ? (parseFloat(amount) * ethPrice).toLocaleString(undefined, { maximumFractionDigits: 2 }) : parseFloat(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                )}
              </div>

              <div className="flex justify-center my-1 relative z-10">
                <motion.button 
                  whileHover={{ scale: 1.1, rotate: 180 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { setIsEthToUsdm(!isEthToUsdm); setAmount(""); setSwapSuccess(false); }} 
                  className="w-10 h-10 rounded-full bg-[#d4c4a8] hover:bg-[#c4b498] flex items-center justify-center cursor-pointer shadow-lg" 
                  data-testid="button-switch-direction"
                >
                  <ArrowUpDown className="w-4 h-4 text-[#0a0a0a]" strokeWidth={2.5} />
                </motion.button>
              </div>

              <div className="bg-neutral-800/50 rounded-xl p-3 border border-neutral-700/50">
                <div className="flex justify-between text-xs text-neutral-500 mb-2">
                  <span>You Receive</span>
                  <span>Balance: {isEthToUsdm ? usdmBalance : ethBalance}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowTokenModal('to')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 transition-colors cursor-pointer"
                    data-testid="button-select-to-token"
                  >
                    {isEthToUsdm ? (
                      <div className="w-5 h-5 rounded-full bg-[#d4c4a8] flex items-center justify-center text-[#0a0a0a] font-bold text-[10px]">$</div>
                    ) : (
                      <img src="https://assets.coingecko.com/coins/images/279/small/ethereum.png" className="w-5 h-5 rounded-full" alt="ETH" />
                    )}
                    <span className="font-medium text-sm text-white">{isEthToUsdm ? 'USDM' : 'ETH'}</span>
                    <ChevronDown className="w-4 h-4 text-neutral-400" />
                  </button>
                  <div className="flex-1 text-right text-xl font-bold text-neutral-400" data-testid="text-output-amount">
                    {calculateOutput()}
                  </div>
                </div>
                {amount && parseFloat(amount) > 0 && (
                  <div className="text-xs text-neutral-500 mt-2 text-right">
                    ≈ ${isEthToUsdm ? calculateOutput() : (parseFloat(calculateOutput()) * ethPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                )}
              </div>

              {amount && parseFloat(amount) > 0 && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-neutral-800/30 rounded-xl p-3 text-xs space-y-1.5 border border-neutral-700/30"
                >
                  <div className="flex justify-between text-neutral-500">
                    <span>Rate</span>
                    <span className="text-neutral-400" data-testid="text-swap-rate">1 ETH = {(ethPrice * 0.997).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDM</span>
                  </div>
                  <div className="flex justify-between text-neutral-500">
                    <span>Fee</span>
                    <span className="text-neutral-400">0.3%</span>
                  </div>
                  <div className="flex justify-between text-white pt-1.5 border-t border-neutral-700">
                    <span className="flex items-center gap-1"><Zap className="w-3 h-3" />Speed</span>
                    <span>~2 seconds</span>
                  </div>
                </motion.div>
              )}

              {!authenticated ? (
                <Button onClick={login} className="w-full h-11 bg-[#d4c4a8] hover:bg-[#c4b498] text-[#0a0a0a] font-bold cursor-pointer" data-testid="button-connect-swap">
                  Connect Wallet
                </Button>
              ) : (
                <Button 
                  onClick={handleSwap} 
                  disabled={isSwapping || !amount || parseFloat(amount) <= 0} 
                  className="w-full h-11 bg-[#d4c4a8] hover:bg-[#c4b498] text-[#0a0a0a] font-bold cursor-pointer disabled:opacity-40 disabled:bg-neutral-700 disabled:text-neutral-500 transition-all" 
                  data-testid="button-swap"
                >
                  {isSwapping ? <><Activity className="w-4 h-4 animate-spin mr-2" />Swapping...</> : <><Zap className="w-4 h-4 mr-2" />Swap Now</>}
                </Button>
              )}

              {swapSuccess && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-green-900/20 border border-green-800/30 rounded-xl p-3"
                >
                  <div className="flex items-center gap-2 text-green-400 font-semibold text-sm mb-0.5">
                    <Check className="w-4 h-4" />Swap Successful!
                  </div>
                  <p className="text-xs text-neutral-500">Your tokens have been swapped.</p>
                </motion.div>
              )}
            </div>

          </motion.div>
        </div>
      </main>

      <footer className="relative z-10 py-4 text-center text-neutral-500 text-sm">
        © 2026 MegaSwap. All rights reserved.
      </footer>

      <AnimatePresence>
        {showTokenModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setShowTokenModal(null)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-neutral-900 rounded-t-3xl border-t border-neutral-800 max-h-[70vh] overflow-hidden"
            >
              <div className="p-4 border-b border-neutral-800 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">Select Token</h3>
                <button 
                  onClick={() => setShowTokenModal(null)}
                  className="p-2 hover:bg-neutral-800 rounded-full transition-colors cursor-pointer"
                  data-testid="button-close-token-modal"
                >
                  <X className="w-5 h-5 text-neutral-400" />
                </button>
              </div>
              <div className="p-4 border-b border-neutral-800">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type="text"
                    placeholder="Search tokens..."
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-[#d4c4a8]"
                    data-testid="input-search-token"
                  />
                </div>
              </div>
              <div className="p-2 max-h-[300px] overflow-y-auto">
                <button
                  onClick={() => { setIsEthToUsdm(showTokenModal === 'from'); setShowTokenModal(null); }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
                  data-testid="token-option-eth"
                >
                  <img src="https://assets.coingecko.com/coins/images/279/small/ethereum.png" className="w-8 h-8 rounded-full" alt="ETH" />
                  <div className="text-left">
                    <div className="font-medium text-white">ETH</div>
                    <div className="text-xs text-neutral-500">Ethereum</div>
                  </div>
                </button>
                <button
                  onClick={() => { setIsEthToUsdm(showTokenModal === 'to'); setShowTokenModal(null); }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
                  data-testid="token-option-usdm"
                >
                  <div className="w-8 h-8 rounded-full bg-[#d4c4a8] flex items-center justify-center text-[#0a0a0a] font-bold text-sm">$</div>
                  <div className="text-left">
                    <div className="font-medium text-white">USDM</div>
                    <div className="text-xs text-neutral-500">MegaSwap USD</div>
                  </div>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
