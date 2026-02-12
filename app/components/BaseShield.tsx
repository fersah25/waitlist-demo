"use client";

import React, { useState, useEffect } from 'react';

// Types for GoPlus Response
interface GoPlusTokenSecurity {
    contract_address: string;
    is_honeypot: string; // "1" or "0"
    buy_tax: string; // e.g. "0.10" = 10%
    sell_tax: string; // e.g. "0.10" = 10%
    is_proxy: string; // "1" or "0"
    owner_address: string; // address string or ""
    lp_holder_count: string; // number as string
    is_open_source: string; // "1" or "0"
    [key: string]: unknown; // Allow other properties for raw display
}

interface GoPlusResponse {
    code: number;
    message: string;
    result: Record<string, GoPlusTokenSecurity>;
}

// Types for DEXScreener Response
interface DexPair {
    chainId: string;
    dexId: string;
    url: string;
    baseToken: {
        address: string;
        name: string;
        symbol: string;
    };
    liquidity?: {
        usd?: number;
    };
    priceUsd?: string;
}

interface DexScreenerResponse {
    schemaVersion: string;
    pairs: DexPair[] | null;
}

interface SecurityAnalysis {
    trustScore: number;
    details: GoPlusTokenSecurity;
}

const BaseShield: React.FC = () => {
    const [contractAddress, setContractAddress] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<SecurityAnalysis | null>(null);

    // DEX Data State
    const [dexData, setDexData] = useState<DexPair | null>(null);
    const [dexError, setDexError] = useState<string | null>(null);

    // Constants
    const CHAIN_ID = '8453'; // Base Network

    // Reset analysis when address changes to prevent stale data display
    useEffect(() => {
        if (analysis && analysis.details.contract_address.toLowerCase() !== contractAddress.toLowerCase()) {
            // Optional: Keep until new search
        }
    }, [contractAddress, analysis]);

    const fetchDexData = async (address: string) => {
        setDexError(null);
        setDexData(null);
        try {
            const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
            const data: DexScreenerResponse = await response.json();

            if (!data.pairs || data.pairs.length === 0) {
                setDexError('Bu token henüz yeni veya Base ağında değil.');
                return;
            }

            const basePair = data.pairs.find(pair => pair.chainId === 'base');

            if (basePair) {
                setDexData(basePair);
            } else {
                const anyPair = data.pairs[0];
                if (anyPair.chainId !== 'base') {
                    setDexError('Token bulundu fakat Base ağında işlem görmüyor.');
                } else {
                    setDexData(anyPair);
                }
            }

        } catch (err: unknown) {
            console.error(err);
            setDexError('DEX verisi alınamadı.');
        }
    };

    const fetchSecurityData = async () => {
        if (!contractAddress) {
            setError('Please enter a contract address.');
            return;
        }

        const lowerAddr = contractAddress.toLowerCase();

        if (!/^0x[a-fA-F0-9]{40}$/.test(lowerAddr)) {
            setError('Invalid contract address format.');
            return;
        }

        setLoading(true);
        setError(null);
        setAnalysis(null);
        setDexData(null);
        setDexError(null);

        try {
            await fetchDexData(lowerAddr);

            const response = await fetch(`https://api.gopluslabs.io/api/v1/token_security/${CHAIN_ID}?contract_addresses=${lowerAddr}`);
            const data: GoPlusResponse = await response.json();

            if (data.code !== 1 || !data.result) {
                throw new Error(data.message || 'Failed to fetch security data.');
            }

            const tokenData = data.result[lowerAddr];

            if (!tokenData) {
                throw new Error('Token bulunamadı, lütfen adresi kontrol edin.');
            }

            calculateTrustScore(tokenData);
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('An unknown error occurred while fetching data.');
            }
        } finally {
            setLoading(false);
        }
    };

    const calculateTrustScore = (data: GoPlusTokenSecurity) => {
        let score = 100;

        if (data.is_honeypot === '1') score -= 50;

        const buyTax = parseFloat(data.buy_tax || '0');
        const sellTax = parseFloat(data.sell_tax || '0');
        if (buyTax > 0.1 || sellTax > 0.1) score -= 20;

        if (data.is_proxy === '1') score -= 10;

        if (data.owner_address && data.owner_address !== '0x0000000000000000000000000000000000000000') score -= 5;

        if (data.is_open_source === '0') score -= 15;

        setAnalysis({
            trustScore: Math.max(0, score),
            details: data
        });
    };

    return (
        <div className="min-h-screen bg-[#0a0b0d] text-white flex flex-col items-center p-4 font-sans">
            <div className="w-full max-w-md space-y-6">

                {/* Header */}
                <header className="flex flex-col items-center justify-center pt-8 pb-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="relative">
                            <div className="absolute inset-0 bg-blue-500 blur-lg opacity-20 rounded-full"></div>
                            <span className="relative text-3xl">🛡️</span>
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-white drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">
                            BaseShield
                        </h1>
                    </div>
                    <p className="text-zinc-500 text-sm font-medium tracking-wide uppercase">Elite Security Scanner</p>
                </header>

                {/* Input Area */}
                <div className="bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-800 shadow-xl backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                        <div className="flex-1 bg-zinc-950/80 rounded-xl flex items-center px-4 py-3 border border-zinc-800 focus-within:border-blue-500/50 transition-colors">
                            <input
                                type="text"
                                value={contractAddress}
                                onChange={(e) => setContractAddress(e.target.value)}
                                placeholder="Paste format 0x..."
                                className="w-full bg-transparent text-white placeholder-zinc-600 outline-none font-mono text-sm"
                            />
                        </div>
                        <button
                            onClick={fetchSecurityData}
                            disabled={loading}
                            className={`px-6 py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-900/20 transition-all ${loading
                                    ? 'bg-zinc-800 text-zinc-500 cursor-wait'
                                    : 'bg-[#0052FF] hover:bg-[#004ad9] hover:shadow-blue-600/30 text-white active:scale-95'
                                }`}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                                </span>
                            ) : 'SCAN'}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                        <span>⚠️</span> {error}
                    </div>
                )}

                {/* Main Content Area */}
                {!analysis && !loading && !dexData && (
                    <div className="flex flex-col items-center justify-center py-20 text-zinc-700 animate-in fade-in duration-700">
                        <span className="text-6xl mb-4 opacity-50 grayscale">🔍</span>
                        <p className="text-zinc-600 font-medium">Ready to scan Base Network</p>
                    </div>
                )}

                {/* Token Found Card */}
                {dexData && (
                    <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full -mr-10 -mt-10 pointer-events-none"></div>

                        <div className="relative z-10 flex justify-between items-start">
                            <div>
                                <h3 className="text-2xl font-bold text-white tracking-tight">{dexData.baseToken.name}</h3>
                                <div className="flex items-center gap-2 text-zinc-400 mt-1">
                                    <span className="font-bold text-blue-400">${dexData.baseToken.symbol}</span>
                                    {dexData.priceUsd && (
                                        <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded text-zinc-500">
                                            ${parseFloat(dexData.priceUsd).toFixed(6)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {dexData.liquidity?.usd !== undefined && (
                                <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold tracking-wide uppercase ${dexData.liquidity.usd > 10000
                                        ? 'bg-green-500/10 border-green-500/20 text-green-400'
                                        : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                                    }`}>
                                    Liq: ${(dexData.liquidity.usd / 1000).toFixed(1)}K
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Security Dashboard */}
                {analysis && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">

                        {/* Trust Score Card */}
                        <div className="bg-gradient-to-b from-zinc-900 to-[#0a0b0d] border border-zinc-800 rounded-3xl p-6 text-center relative overflow-hidden">
                            {/* Glowing Background for Score */}
                            <div className={`absolute inset-0 opacity-10 blur-2xl ${analysis.trustScore >= 80 ? 'bg-green-500' :
                                    analysis.trustScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}></div>

                            <div className="relative z-10">
                                <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4">Trust Score</h3>
                                <div className={`text-6xl font-black tracking-tighter mb-2 ${analysis.trustScore >= 80 ? 'text-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.3)]' :
                                        analysis.trustScore >= 50 ? 'text-yellow-400' :
                                            'text-red-500'
                                    }`}>
                                    {analysis.trustScore}
                                </div>
                                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden max-w-[200px] mx-auto">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ease-out ${analysis.trustScore >= 80 ? 'bg-green-500' :
                                                analysis.trustScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                            }`}
                                        style={{ width: `${analysis.trustScore}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>

                        {/* Status Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            {/* Honeypot */}
                            <div className={`p-4 rounded-2xl border ${analysis.details.is_honeypot === '1'
                                    ? 'bg-red-500/10 border-red-500/20'
                                    : 'bg-green-500/10 border-green-500/20'
                                }`}>
                                <div className="text-xs text-zinc-500 uppercase font-bold mb-1">Honeypot</div>
                                <div className={`text-lg font-bold ${analysis.details.is_honeypot === '1' ? 'text-red-400' : 'text-green-400'
                                    }`}>
                                    {analysis.details.is_honeypot === '1' ? 'DETECTED' : 'SAFE'}
                                </div>
                            </div>

                            {/* Taxes */}
                            <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
                                <div className="text-xs text-zinc-500 uppercase font-bold mb-1">Buy / Sell Tax</div>
                                <div className="text-lg font-bold text-white flex gap-1">
                                    <span className={parseFloat(analysis.details.buy_tax) > 0.1 ? 'text-red-400' : 'text-zinc-300'}>
                                        {(parseFloat(analysis.details.buy_tax) * 100).toFixed(0)}%
                                    </span>
                                    <span className="text-zinc-600">/</span>
                                    <span className={parseFloat(analysis.details.sell_tax) > 0.1 ? 'text-red-400' : 'text-zinc-300'}>
                                        {(parseFloat(analysis.details.sell_tax) * 100).toFixed(0)}%
                                    </span>
                                </div>
                            </div>

                            {/* Contract */}
                            <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
                                <div className="text-xs text-zinc-500 uppercase font-bold mb-1">Contract</div>
                                <div className="text-lg font-bold text-white">
                                    {analysis.details.is_proxy === '1' ? (
                                        <span className="text-yellow-400">Proxy</span>
                                    ) : (
                                        <span className="text-zinc-300">Standard</span>
                                    )}
                                </div>
                            </div>

                            {/* Ownership */}
                            <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
                                <div className="text-xs text-zinc-500 uppercase font-bold mb-1">Ownership</div>
                                <div className="text-lg font-bold text-white">
                                    {(!analysis.details.owner_address || analysis.details.owner_address === '0x0000000000000000000000000000000000000000') ? (
                                        <span className="text-green-400">Renounced</span>
                                    ) : (
                                        <span className="text-yellow-400">Owner Active</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Raw Data Toggle */}
                        <div className="pt-4">
                            <details className="group">
                                <summary className="list-none text-center cursor-pointer text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                                    View Raw Data
                                </summary>
                                <div className="mt-4 p-4 bg-black rounded-xl border border-zinc-800 overflow-hidden">
                                    <pre className="text-[10px] text-green-500 font-mono overflow-auto max-h-40">
                                        {JSON.stringify(analysis.details, null, 2)}
                                    </pre>
                                </div>
                            </details>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};

export default BaseShield;