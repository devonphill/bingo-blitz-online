
/**
 * Format ticket information for display in toast notifications
 * @param ticket The ticket object containing numbers and metadata
 * @param calledNumbers Array of called numbers in the game
 * @returns Formatted plain text string for toast display
 */
export function formatTicketForToast(ticket: any, calledNumbers: number[] = []): string {
  if (!ticket || !ticket.numbers) {
    return 'No ticket data available';
  }
  
  const displayNumbers = ticket.numbers.slice(0, 5);
  const totalMarked = ticket.numbers.filter((n: number) => calledNumbers.includes(n)).length;
  const totalNumbers = ticket.numbers.length;
  
  // Format the numbers to highlight called ones
  const numbersDisplay = displayNumbers
    .map(n => calledNumbers.includes(n) ? `[${n}]` : n)
    .join(', ');
  
  // Add info about more numbers if applicable
  const moreNumbersText = totalNumbers > 5 ? ` (+${totalNumbers - 5} more)` : '';
  
  // Put it all together
  return `${numbersDisplay}${moreNumbersText}\nTicket: ${ticket.serial || 'Unknown'} • ${totalMarked}/${totalNumbers} called`;
}
