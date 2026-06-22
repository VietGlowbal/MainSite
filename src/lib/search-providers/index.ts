/**
 * Search Provider Factory
 * 
 * Task 3.4: Create search provider factory and configuration
 * 
 * This module provides a factory function to get the configured search provider
 * based on the COURSE_SEARCH_PROVIDER environment variable.
 * 
 * Currently supported providers:
 * - tavily (default)
 * - serpapi (planned)
 * - bing (planned)
 * - exa (planned)
 * - firecrawl (planned)
 */

import type { SearchProvider } from './search-provider-interface';
import { TavilySearchProvider } from './tavily-provider';

/**
 * Supported search provider names
 */
export type ProviderName = 'tavily' | 'serpapi' | 'bing' | 'exa' | 'firecrawl';

/**
 * Error thrown when provider configuration is invalid
 */
export class ProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderConfigError';
  }
}

/**
 * Get the configured search provider instance
 * 
 * Reads from COURSE_SEARCH_PROVIDER environment variable.
 * Defaults to 'tavily' if not specified.
 * 
 * @throws ProviderConfigError if provider is not supported
 * @returns SearchProvider instance
 */
export function getSearchProvider(): SearchProvider {
  const providerName = (process.env.COURSE_SEARCH_PROVIDER || 'tavily').toLowerCase() as ProviderName;
  
  switch (providerName) {
    case 'tavily':
      return new TavilySearchProvider();
    
    case 'serpapi':
    case 'bing':
    case 'exa':
    case 'firecrawl':
      throw new ProviderConfigError(
        `Provider "${providerName}" is not yet implemented. Currently only "tavily" is supported.`
      );
    
    default:
      throw new ProviderConfigError(
        `Unknown provider "${providerName}". Supported providers: tavily, serpapi, bing, exa, firecrawl`
      );
  }
}

/**
 * Check if a provider is available
 * 
 * @param providerName - Provider to check
 * @returns true if provider is implemented
 */
export function isProviderAvailable(providerName: ProviderName): boolean {
  return providerName === 'tavily';
}

/**
 * Get list of available (implemented) providers
 * 
 * @returns Array of provider names
 */
export function getAvailableProviders(): ProviderName[] {
  return ['tavily'];
}

/**
 * Get the configured provider name from environment
 * 
 * @returns The provider name (defaults to 'tavily')
 */
export function getConfiguredProviderName(): ProviderName {
  return (process.env.COURSE_SEARCH_PROVIDER || 'tavily').toLowerCase() as ProviderName;
}

/**
 * Task 26.2: Provider health check
 * 
 * Test if the configured provider is available and has valid credentials.
 * Returns health status with diagnostic information.
 * 
 * @returns Promise with health check results
 */
export async function checkProviderHealth(): Promise<{
  available: boolean;
  provider: ProviderName;
  error?: string;
  warning?: string;
}> {
  const providerName = getConfiguredProviderName();
  
  // Check if provider is implemented
  if (!isProviderAvailable(providerName)) {
    return {
      available: false,
      provider: providerName,
      error: `Provider "${providerName}" is not yet implemented. Only "tavily" is currently supported.`,
      warning: 'Course search will fall back to manual URL paste.',
    };
  }
  
  // Check provider-specific configuration
  switch (providerName) {
    case 'tavily': {
      const apiKey = process.env.TAVILY_API_KEY;
      
      if (!apiKey) {
        return {
          available: false,
          provider: providerName,
          error: 'TAVILY_API_KEY environment variable is not set.',
          warning: 'Course search will fall back to manual URL paste.',
        };
      }
      
      // Basic API key format validation
      if (!apiKey.startsWith('tvly-')) {
        return {
          available: false,
          provider: providerName,
          error: 'TAVILY_API_KEY appears to be invalid (should start with "tvly-").',
          warning: 'Course search will fall back to manual URL paste.',
        };
      }
      
      // Try to create provider instance (validates configuration)
      try {
        const provider = new TavilySearchProvider();
        
        // Optional: Perform actual connectivity test
        // Skipped in health check to avoid API costs
        // Real validation happens on first search attempt
        
        return {
          available: true,
          provider: providerName,
        };
      } catch (error) {
        return {
          available: false,
          provider: providerName,
          error: error instanceof Error ? error.message : 'Failed to initialize provider',
          warning: 'Course search will fall back to manual URL paste.',
        };
      }
    }
    
    default:
      return {
        available: false,
        provider: providerName,
        error: `Health check not implemented for provider "${providerName}".`,
        warning: 'Course search will fall back to manual URL paste.',
      };
  }
}

/**
 * Task 26.2: Log provider health warnings
 * 
 * Check provider health and log warnings if provider is unavailable.
 * This should be called on server startup (optional).
 * 
 * Does not throw errors - gracefully logs warnings and allows app to continue.
 */
export async function logProviderHealthWarnings(): Promise<void> {
  try {
    const health = await checkProviderHealth();
    
    if (!health.available) {
      console.warn('[Search Provider] Provider unavailable:', {
        provider: health.provider,
        error: health.error,
        fallback: health.warning,
      });
    } else {
      console.log('[Search Provider] Provider healthy:', {
        provider: health.provider,
        status: 'available',
      });
    }
  } catch (error) {
    console.error('[Search Provider] Health check failed:', error);
  }
}

// Re-export types and utilities for convenience
export type { SearchProvider, SearchParams, SearchResult } from './search-provider-interface';
export {
  constructSearchQuery,
  extractDomain,
  validateDomain,
  normalizeUrl,
} from './search-provider-interface';
