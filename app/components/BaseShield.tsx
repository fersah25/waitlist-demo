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

// Types for DEXScreener Response based on Official Docs
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
    // State
    const [contractAddress, setContractAddress] = useState<string>('');
    const [cleanAddress, setCleanAddress] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<SecurityAnalysis | null>(null);
    const [dexData, setDexData] = useState<DexPair | null>(null);

    // Constants
    const CHAIN_ID = '8453'; // Base Network

    // Reset analysis only when starting a new scan, handled in checkToken

    const checkToken = async () => {
        // 1. Address Normalization
        const normalizedAddress = contractAddress.trim().toLowerCase();

        if (!normalizedAddress.startsWith('0x') || normalizedAddress.length !== 42) {
            setError('Please enter a valid contract address (0x... + 40 chars)');
            return;
        }

        setCleanAddress(normalizedAddress);
        setLoading(true);
        setError(null);
        setAnalysis(null);
        setDexData(null);

        // Define Parallel Tasks

        // Task A: DEXScreener Fetch
        const fetchDex = async () => {
            try {
                const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${normalizedAddress}`);

                // Handle HTTP errors gracefully
                if (!response.ok) {
                    console.warn(`DEXScreener API error: ${response.status}`);
                    return null;
                }

                const data: DexScreenerResponse = await response.json();

                // Strict Safety Check as requested
                if (!data || !data.pairs || data.pairs.length === 0) {
                    // No pools found - logical explicit handling
                    console.log('No liquidity pools found for this token.');
                    return null;
                }

                // Filter for Base network specifically
                const basePair = data.pairs.find(p => p.chainId === 'base');

                if (basePair) {
                    return basePair;
                } else {
                    // Fallback to first pair if Base specific not found? 
                    // Prompt implies specific filter, but let's be safe and return first valid if base not found
                    // to not show empty if it exists elsewhere. 
                    // However, strict prompt says "Filter for the Base network specifically".
                    // If not on Base, maybe return null to be strict?
                    // Let's stick to the prompt's request for Base but fall back to [0] commonly in implementation unless strictly forbidden.
                    // "Filter for the Base network specifically: const basePair = data.pairs.find(p => p.chainId === 'base');"
                    return basePair || null;
                }

            } catch (err) {
                console.error('DEXScreener Fetch Failed:', err);
                return null;
            }
        };

        // Task B: GoPlus Security Fetch
        const fetchSecurity = async () => {
            try {
                const response = await fetch(`https://api.gopluslabs.io/api/v1/token_security/${CHAIN_ID}?contract_addresses=${normalizedAddress}`);

                if (!response.ok) {
                    throw new Error(`GoPlus API error: ${response.status}`);
                }

                const data: GoPlusResponse = await response.json();

                // Validation
                if (data?.result?.[normalizedAddress]) {
                    return data.result[normalizedAddress];
                }
                return null;

            } catch (err) {
                console.error('GoPlus Fetch Failed:', err);
                return null;
            }
        };

        try {
            // Run Parallel Requests
            const [dexResult, securityResult] = await Promise.all([fetchDex(), fetchSecurity()]);

            // Handle DEX Results
            if (dexResult) {
                setDexData(dexResult);
            } else {
                // If no DEX data, we don't error out yet, we check security
            }

            // Handle Security Results
            if (securityResult) {
                calculateTrustScore(securityResult);
            } else {
                // If neither found
                if (!dexResult) {
                    setError('No token data found. This address may be a wallet or unlisted.');
                } else {
                    setError('Security data unavailable, but token market data found.');
                }
            }

        } catch (err: unknown) {
            console.error('Global Fetch Error:', err);
            setError('An unexpected error occurred during the scan.');
        } finally {
            setLoading(false);
        }
    };

    const calculateTrustScore = (data: GoPlusTokenSecurity) => {
        let score = 100;

        if (data?.is_honeypot === '1') score -= 50;

        const buyTax = parseFloat(data?.buy_tax || '0');
        const sellTax = parseFloat(data?.sell_tax || '0');
        if (buyTax > 0.1 || sellTax > 0.1) score -= 20;

        if (data?.is_proxy === '1') score -= 10;

        if (data?.owner_address && data.owner_address !== '0x0000000000000000000000000000000000000000') score -= 5;

        if (data?.is_open_source === '0') score -= 15;

        setAnalysis({
            trustScore: Math.max(0, score),
            details: data
        });
    };

    return (
        <div style={{
            backgroundColor: '#0a0b0d',
            color: 'white',
            minHeight: '100vh',
            padding: '20px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        }}>
            <div style={{ maxWidth: '420px', margin: '0 auto' }}>

                {/* Header */}
                <div style={{ textAlign: 'center', paddingTop: '40px', paddingBottom: '30px' }}>
                    <h1 style={{
                        fontSize: '32px',
                        fontWeight: '800',
                        margin: '0 0 8px 0',
                        background: 'linear-gradient(to right, #60a5fa, #ffffff)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        display: 'inline-block'
                    }}>
                        🛡️ BaseShield
                    </h1>
                    <p style={{
                        color: '#71717a',
                        fontSize: '12px',
                        textTransform: 'uppercase',
                        letterSpacing: '2px',
                        fontWeight: '600',
                        marginTop: '0'
                    }}>
                        Elite Security Scanner
                    </p>
                </div>

                {/* Input Area */}
                <div style={{
                    backgroundColor: 'rgba(24, 24, 27, 0.5)',
                    padding: '8px',
                    borderRadius: '16px',
                    border: '1px solid #27272a',
                    marginBottom: '24px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
                }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            type="text"
                            value={contractAddress}
                            onChange={(e) => setContractAddress(e.target.value)}
                            placeholder="Paste format 0x..."
                            style={{
                                flex: 1,
                                backgroundColor: '#09090b',
                                color: 'white',
                                border: '1px solid #0052FF',
                                borderRadius: '12px',
                                padding: '14px',
                                fontSize: '14px',
                                fontFamily: 'monospace',
                                outline: 'none'
                            }}
                        />
                    </div>
                    <button
                        onClick={checkToken}
                        disabled={loading}
                        style={{
                            backgroundColor: '#0052FF',
                            color: 'white',
                            fontWeight: 'bold',
                            border: 'none',
                            borderRadius: '12px',
                            padding: '14px',
                            width: '100%',
                            marginTop: '8px',
                            cursor: loading ? 'wait' : 'pointer',
                            opacity: loading ? 0.7 : 1,
                            fontSize: '14px',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {loading ? 'SCANNING...' : 'SCAN'}
                    </button>
                    {error && (
                        <div style={{
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            color: '#f87171',
                            padding: '12px',
                            borderRadius: '12px',
                            marginTop: '12px',
                            fontSize: '13px'
                        }}>
                            ⚠️ {error}
                        </div>
                    )}
                </div>

                {/* Manual Link Button */}
                {cleanAddress && cleanAddress.length === 42 && (
                    <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                        <a
                            href={`https://dexscreener.com/base/${cleanAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                backgroundColor: '#18181b',
                                color: '#a1a1aa',
                                fontSize: '12px',
                                padding: '8px 16px',
                                borderRadius: '999px',
                                textDecoration: 'none',
                                border: '1px solid #27272a',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <span>📊</span> View Data on DEXScreener
                        </a>
                    </div>
                )}

                {/* Empty State */}
                {!analysis && !loading && !dexData && (
                    <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.5 }}>
                        <div style={{ fontSize: '64px', marginBottom: '16px', filter: 'grayscale(1)' }}>🔍</div>
                        <p style={{ color: '#71717a', fontWeight: '500' }}>Ready to scan Base Network</p>
                    </div>
                )}

                {/* Token Found Card */}
                {dexData ? (
                    <div style={{
                        backgroundColor: '#16181d',
                        border: '1px solid #27272a',
                        borderRadius: '16px',
                        padding: '20px',
                        marginBottom: '20px',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                            <div>
                                <h3 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0', color: 'white' }}>{dexData.baseToken.name}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>${dexData.baseToken.symbol}</span>
                                    {dexData.priceUsd && (
                                        <span style={{ backgroundColor: '#27272a', color: '#a1a1aa', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>
                                            ${parseFloat(dexData.priceUsd).toFixed(6)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {dexData.liquidity?.usd !== undefined ? (
                                <div style={{
                                    padding: '6px 10px',
                                    borderRadius: '8px',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase',
                                    backgroundColor: dexData.liquidity.usd > 10000 ? 'rgba(74, 222, 128, 0.1)' : 'rgba(250, 204, 21, 0.1)',
                                    color: dexData.liquidity.usd > 10000 ? '#4ade80' : '#facc15',
                                    border: `1px solid ${dexData.liquidity.usd > 10000 ? 'rgba(74, 222, 128, 0.2)' : 'rgba(250, 204, 21, 0.2)'}`
                                }}>
                                    Liq: ${(dexData.liquidity.usd / 1000).toFixed(1)}K
                                </div>
                            ) : (
                                <div style={{
                                    padding: '6px 10px',
                                    borderRadius: '8px',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase',
                                    backgroundColor: 'rgba(113, 113, 122, 0.1)',
                                    color: '#71717a',
                                    border: '1px solid rgba(113, 113, 122, 0.2)'
                                }}>
                                    Liq: Unknown
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    // If analysis exists but no dexdata (e.g. unlisted but security checked), show a placeholder or nothing?
                    // Currently showing nothing for dex data if null.
                    null
                )}

                {/* Security Dashboard */}
                {analysis && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                        {/* Trust Score Card */}
                        <div style={{
                            background: 'linear-gradient(to bottom, #18181b, #0a0b0d)',
                            border: '1px solid #27272a',
                            borderRadius: '24px',
                            padding: '24px',
                            textAlign: 'center',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <div style={{ fontSize: '10px', color: '#71717a', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '16px' }}>Trust Score</div>
                            <div style={{
                                fontSize: '56px',
                                fontWeight: '900',
                                lineHeight: '1',
                                marginBottom: '16px',
                                color: analysis.trustScore >= 80 ? '#4ade80' : analysis.trustScore >= 50 ? '#facc15' : '#ef4444',
                                textShadow: analysis.trustScore >= 80 ? '0 0 20px rgba(74, 222, 128, 0.3)' : 'none'
                            }}>
                                {analysis.trustScore}
                            </div>
                            <div style={{ height: '6px', width: '100%', backgroundColor: '#27272a', borderRadius: '999px', overflow: 'hidden', maxWidth: '200px', margin: '0 auto' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${analysis.trustScore}%`,
                                    backgroundColor: analysis.trustScore >= 80 ? '#4ade80' : analysis.trustScore >= 50 ? '#facc15' : '#ef4444',
                                    borderRadius: '999px',
                                    transition: 'width 1s ease-out'
                                }}></div>
                            </div>
                        </div>

                        {/* Status Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            {/* Honeypot */}
                            <div style={{
                                padding: '16px',
                                borderRadius: '16px',
                                border: '1px solid',
                                backgroundColor: analysis.details.is_honeypot === '1' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(74, 222, 128, 0.1)',
                                borderColor: analysis.details.is_honeypot === '1' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(74, 222, 128, 0.2)'
                            }}>
                                <div style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>Honeypot</div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: analysis.details.is_honeypot === '1' ? '#f87171' : '#4ade80' }}>
                                    {analysis.details.is_honeypot === '1' ? 'DETECTED' : 'SAFE'}
                                </div>
                            </div>

                            {/* Taxes */}
                            <div style={{ backgroundColor: 'rgba(24, 24, 27, 0.5)', border: '1px solid #27272a', padding: '16px', borderRadius: '16px' }}>
                                <div style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>Buy / Sell Tax</div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>
                                    <span style={{ color: parseFloat(analysis.details.buy_tax) > 0.1 ? '#f87171' : '#d4d4d8' }}>{(parseFloat(analysis.details.buy_tax) * 100).toFixed(0)}%</span>
                                    <span style={{ color: '#52525b', margin: '0 4px' }}>/</span>
                                    <span style={{ color: parseFloat(analysis.details.sell_tax) > 0.1 ? '#f87171' : '#d4d4d8' }}>{(parseFloat(analysis.details.sell_tax) * 100).toFixed(0)}%</span>
                                </div>
                            </div>

                            {/* Contract */}
                            <div style={{ backgroundColor: 'rgba(24, 24, 27, 0.5)', border: '1px solid #27272a', padding: '16px', borderRadius: '16px' }}>
                                <div style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>Contract</div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>
                                    {analysis.details.is_proxy === '1' ? (
                                        <span style={{ color: '#facc15' }}>Proxy</span>
                                    ) : (
                                        <span style={{ color: '#d4d4d8' }}>Standard</span>
                                    )}
                                </div>
                            </div>

                            {/* Ownership */}
                            <div style={{ backgroundColor: 'rgba(24, 24, 27, 0.5)', border: '1px solid #27272a', padding: '16px', borderRadius: '16px' }}>
                                <div style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>Ownership</div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>
                                    {(!analysis.details.owner_address || analysis.details.owner_address === '0x0000000000000000000000000000000000000000') ? (
                                        <span style={{ color: '#4ade80' }}>Renounced</span>
                                    ) : (
                                        <span style={{ color: '#facc15' }}>Active</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Raw Data Toggle */}
                        <div style={{ marginTop: '16px' }}>
                            <details style={{ cursor: 'pointer' }}>
                                <summary style={{ listStyle: 'none', textAlign: 'center', fontSize: '12px', color: '#52525b', padding: '8px' }}>
                                    View Raw Data
                                </summary>
                                <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#000', borderRadius: '12px', border: '1px solid #27272a', overflow: 'hidden' }}>
                                    <pre style={{ fontSize: '10px', color: '#22c55e', margin: 0, overflow: 'auto', maxHeight: '160px' }}>
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