"use client";
import React, { useState, useEffect } from "react";
import { useAccount, useBalance } from "wagmi";
import {
    Identity,
    Avatar,
    Name,
    Address
} from "@coinbase/onchainkit/identity";
import {
    ConnectWallet,
    Wallet,
    WalletDropdown,
    WalletDropdownDisconnect,
    WalletDropdownBasename,
    WalletDropdownLink
} from '@coinbase/onchainkit/wallet';
import {
    Swap,
    SwapAmountInput,
    SwapToggleButton,
    SwapButton,
    SwapMessage,
    SwapToast
} from '@coinbase/onchainkit/swap';
import { Token } from '@coinbase/onchainkit/token';
import styles from "../page.module.css";

const ethtoken: Token[] = [{
    name: 'ETH',
    address: '',
    symbol: 'ETH',
    decimals: 18,
    image: 'https://wallet-api-production.s3.amazonaws.com/uploads/tokens/eth_288.png',
    chainId: 8453,
}];

const usdctoken: Token[] = [{
    name: 'USDC',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    symbol: 'USDC',
    decimals: 6,
    image: 'https://d3r81g40ycuhqg.cloudfront.net/wallet/wais/44/2b/442b80bd16af0c0d9b22e03a16753823fe826e5bfd457292b55fa0ba8c1ba213-ZWUzYjJmZGUtMDYxNy00NDcyLTg0NjQtMWI4OGEwYjBiODE2',
    chainId: 8453,
}];

// This component contains all the client-side logic
export default function Dashboard() {
    const { address, isConnected } = useAccount();
    const { data: balanceData } = useBalance({
        address: address,
    });

    const [trustScore, setTrustScore] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isConnected && address) {
            setIsLoading(true);

            // Calculate Score Deterministically
            let score = 50; // Base score for connecting

            // Check Balance Tiers
            const balance = balanceData ? parseFloat(balanceData.formatted) : 0;

            if (balance > 0) score += 10;
            if (balance > 0.01) score += 20;
            if (balance > 0.1) score += 20;

            // Simulate a brief calculation delay for effect
            setTimeout(() => {
                setTrustScore(score);
                setIsLoading(false);
            }, 800);

        } else {
            setTrustScore(0);
        }
    }, [address, isConnected, balanceData]);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <Wallet>
                    <ConnectWallet className={styles.walletBadge}>
                        <Avatar className="h-6 w-6" />
                        <Name className={styles.identityName} />
                    </ConnectWallet>
                    <WalletDropdown>
                        <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                            <Avatar />
                            <Name />
                            <Address />
                        </Identity>
                        <WalletDropdownBasename />
                        <WalletDropdownLink icon="wallet" href="https://keys.coinbase.com">
                            Wallet
                        </WalletDropdownLink>
                        <WalletDropdownDisconnect />
                    </WalletDropdown>
                </Wallet>
            </div>

            <div className={styles.dashboard}>
                <div className={`${styles.scoreContainer} ${isLoading ? styles.pulsing : ''}`}>
                    <div className={styles.scoreCircle}>
                        {isConnected ? (
                            <>
                                <div className={styles.scoreValue}>{isLoading ? "..." : trustScore}</div>
                                <div className={styles.scoreLabel}>Trust Score</div>
                            </>
                        ) : (
                            <Wallet>
                                <ConnectWallet className={styles.connectWalletButton} />
                            </Wallet>
                        )}
                    </div>
                </div>

                {isConnected && !isLoading && (
                    <>
                        <div className={styles.statsRow}>
                            <div className={styles.statCard}>
                                <div className={styles.statValue}>
                                    {balanceData ? parseFloat(balanceData.formatted).toFixed(4) : "0.00"}
                                </div>
                                <div className={styles.statLabel}>ETH Balance</div>
                            </div>

                            <div className={styles.statCard}>
                                <div className={styles.statValue}>
                                    Verified
                                </div>
                                <div className={styles.statLabel}>Onchain Status</div>
                            </div>
                        </div>

                        <button
                            className={styles.shareButton}
                            onClick={() => {
                                const text = `My Onchain Trust Score is ${trustScore}! Check yours here:`;
                                const embedUrl = "https://waitlist-demo-neon.vercel.app";
                                // Using warps.at link as requested
                                window.open(`https://warps.at/cast?text=${encodeURIComponent(text + " " + embedUrl)}`, '_blank');
                            }}
                        >
                            Share My Score on Warpcast
                        </button>

                        <div className={styles.swapContainer}>
                            <h3 className={styles.swapTitle}>Quick Swap</h3>
                            <Swap>
                                <SwapAmountInput
                                    label="Sell"
                                    swappableTokens={ethtoken}
                                    token={ethtoken[0]}
                                    type="from"
                                />
                                <SwapToggleButton />
                                <SwapAmountInput
                                    label="Buy"
                                    swappableTokens={usdctoken}
                                    token={usdctoken[0]}
                                    type="to"
                                />
                                <SwapButton />
                                <SwapMessage />
                                <SwapToast />
                            </Swap>
                        </div>
                    </>
                )}

                {!isConnected && (
                    <div style={{ marginTop: '20px' }}>
                        <p style={{ opacity: 0.6, letterSpacing: '0.5px' }}>Connect wallet to analyze trust score</p>
                    </div>
                )}
            </div>
        </div>
    );
}
