interface FooterConfig {
  enabled: boolean;
  text: string;
  frequency: number; // hours between footer injections
}

interface Customer {
  id: string;
  footer_last_sent_at?: string | null;
}

interface FooterResult {
  shouldInject: boolean;
  messageWithFooter?: string;
  footerInjected?: boolean;
}

export class FooterManager {
  private static readonly DEFAULT_FOOTER = 'Reply STOP to opt out, HELP for help. Msg&Data Rates May Apply.';
  private static readonly DEFAULT_FREQUENCY = 24; // 24 hours

  static shouldInjectFooter(
    customer: Customer, 
    config: FooterConfig = { enabled: true, text: this.DEFAULT_FOOTER, frequency: this.DEFAULT_FREQUENCY }
  ): boolean {
    if (!config.enabled) return false;
    
    if (!customer.footer_last_sent_at) return true;
    
    const lastSent = new Date(customer.footer_last_sent_at);
    const now = new Date();
    const hoursSinceLastFooter = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
    
    return hoursSinceLastFooter >= config.frequency;
  }

  static composeMessage(
    originalMessage: string,
    customer: Customer,
    config: FooterConfig = { enabled: true, text: this.DEFAULT_FOOTER, frequency: this.DEFAULT_FREQUENCY }
  ): FooterResult {
    const shouldInject = this.shouldInjectFooter(customer, config);
    
    if (!shouldInject) {
      return {
        shouldInject: false,
        messageWithFooter: originalMessage
      };
    }

    const messageWithFooter = `${originalMessage}\n\n${config.text}`;
    
    // Check if message exceeds SMS length limits
    if (messageWithFooter.length > 160) {
      return this.handleLongMessage(originalMessage, config.text);
    }

    return {
      shouldInject: true,
      messageWithFooter,
      footerInjected: true
    };
  }

  private static handleLongMessage(originalMessage: string, footer: string): FooterResult {
    const maxFirstPartLength = 160 - ' (1/2)'.length;
    const maxSecondPartLength = 160 - ' (2/2)'.length - footer.length - 2; // 2 for \n\n

    if (originalMessage.length <= maxFirstPartLength) {
      // Original message fits in first part, footer goes in second
      return {
        shouldInject: true,
        messageWithFooter: `${originalMessage} (1/2)`,
        footerInjected: true
      };
    }

    // Split message intelligently at word boundaries
    const splitPoint = this.findBestSplitPoint(originalMessage, maxFirstPartLength);
    const firstPart = originalMessage.substring(0, splitPoint).trim();
    const secondPart = originalMessage.substring(splitPoint).trim();

    if (secondPart.length <= maxSecondPartLength) {
      return {
        shouldInject: true,
        messageWithFooter: `${firstPart} (1/2)`,
        footerInjected: true
      };
    }

    // Message too long even when split - send without footer
    return {
      shouldInject: false,
      messageWithFooter: originalMessage
    };
  }

  private static findBestSplitPoint(message: string, maxLength: number): number {
    if (message.length <= maxLength) return message.length;

    // Try to split at sentence boundaries first
    let splitPoint = message.lastIndexOf('. ', maxLength);
    if (splitPoint > maxLength * 0.7) return splitPoint + 2;

    // Try to split at word boundaries
    splitPoint = message.lastIndexOf(' ', maxLength);
    if (splitPoint > maxLength * 0.8) return splitPoint;

    // Last resort - hard split
    return maxLength;
  }

  static getSecondPart(
    originalMessage: string, 
    footer: string,
    splitPoint: number
  ): string {
    const secondPart = originalMessage.substring(splitPoint).trim();
    return `${secondPart} (2/2)\n\n${footer}`;
  }
}