import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../entities/asset.entity';
import axios from 'axios';

@Injectable()
export class AssetSeeder {
  constructor(
    @InjectRepository(Asset)
    private assetRepository: Repository<Asset>,
  ) {}

  async seed(): Promise<void> {
    const count = await this.assetRepository.count();
    if (count > 0) {
      console.log('Assets already seeded, skipping...');
      return;
    }

    try {
      console.log('Fetching assets from Binance API...');
      const response = await axios.get('https://api.binance.com/api/v3/exchangeInfo');
      const symbols = response.data.symbols;
      
      // Filter for USDT trading pairs as they're most common
      const assets = symbols
        .filter(symbol => symbol.quoteAsset === 'USDT' && symbol.status === 'TRADING')
        .map(symbol => ({
          symbol: symbol.baseAsset,
          name: this.getFullName(symbol.baseAsset),
          network: this.getDefaultNetwork(symbol.baseAsset),
          decimals: this.getDefaultDecimals(symbol.baseAsset),
          contractAddress: null,
        }));
      
      // Add top 30 assets to the database
      const topAssets = assets.slice(0, 30);
      
      for (const asset of topAssets) {
        const newAsset = this.assetRepository.create(asset);
        await this.assetRepository.save(newAsset);
      }
      
      console.log(`Seeded ${topAssets.length} assets from Binance`);
    } catch (error) {
      console.error('Failed to seed assets from Binance API:', error.message);
      
      // Fallback: Add common cryptocurrencies if API fails
      console.log('Using fallback asset list...');
      const fallbackAssets = [
        { symbol: 'BTC', name: 'Bitcoin', network: 'BTC', decimals: 8 },
        { symbol: 'ETH', name: 'Ethereum', network: 'ETH', decimals: 18 },
        { symbol: 'BNB', name: 'Binance Coin', network: 'BSC', decimals: 18 },
        { symbol: 'SOL', name: 'Solana', network: 'SOL', decimals: 9 },
        { symbol: 'XRP', name: 'Ripple', network: 'XRP', decimals: 6 },
        { symbol: 'ADA', name: 'Cardano', network: 'ADA', decimals: 6 },
        { symbol: 'DOGE', name: 'Dogecoin', network: 'DOGE', decimals: 8 },
        { symbol: 'MATIC', name: 'Polygon', network: 'MATIC', decimals: 18 },
        { symbol: 'DOT', name: 'Polkadot', network: 'DOT', decimals: 10 },
        { symbol: 'AVAX', name: 'Avalanche', network: 'AVAX', decimals: 18 }
      ];
      
      for (const asset of fallbackAssets) {
        const newAsset = this.assetRepository.create(asset);
        await this.assetRepository.save(newAsset);
      }
      
      console.log(`Seeded ${fallbackAssets.length} fallback assets`);
    }
  }

  private getFullName(symbol: string): string {
    // Map of common symbols to full names
    const nameMap = {
      'BTC': 'Bitcoin',
      'ETH': 'Ethereum',
      'BNB': 'Binance Coin',
      'SOL': 'Solana',
      'XRP': 'Ripple',
      'ADA': 'Cardano',
      'DOGE': 'Dogecoin',
      'MATIC': 'Polygon',
      'DOT': 'Polkadot',
      'AVAX': 'Avalanche',
      'SHIB': 'Shiba Inu',
      'LTC': 'Litecoin',
      'UNI': 'Uniswap',
      'LINK': 'Chainlink',
      'XLM': 'Stellar',
      'ATOM': 'Cosmos',
      'ALGO': 'Algorand',
      'NEAR': 'NEAR Protocol',
      'FTM': 'Fantom',
      'SAND': 'The Sandbox',
      'MANA': 'Decentraland',
      'AAVE': 'Aave',
      'CRO': 'Cronos',
      'EGLD': 'MultiversX',
      'THETA': 'Theta Network'
    };
    
    return nameMap[symbol] || `${symbol} Token`;
  }

  private getDefaultNetwork(symbol: string): string {
    // Map symbols to their native networks
    const networkMap = {
      'BTC': 'BTC',
      'ETH': 'ETH',
      'BNB': 'BSC',
      'SOL': 'SOL',
      'XRP': 'XRP',
      'ADA': 'ADA',
      'DOGE': 'DOGE',
      'MATIC': 'MATIC',
      'DOT': 'DOT',
      'AVAX': 'AVAX',
      'TRX': 'TRON',
      'LTC': 'LTC',
      'ATOM': 'COSMOS'
    };
    
    return networkMap[symbol] || 'ETH'; // Default to ETH network for ERC20 tokens
  }

  private getDefaultDecimals(symbol: string): number {
    // Map symbols to their decimal places
    const decimalsMap = {
      'BTC': 8,
      'ETH': 18,
      'BNB': 18,
      'SOL': 9,
      'XRP': 6,
      'ADA': 6,
      'DOGE': 8,
      'MATIC': 18,
      'DOT': 10,
      'AVAX': 18,
      'SHIB': 18,
      'LTC': 8,
      'XLM': 7
    };
    
    return decimalsMap[symbol] || 18; // Default to 18 decimals (ERC20 standard)
  }
}