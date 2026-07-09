import { ProductPublishingInput } from "./types";

export async function generateDescription(
  input: ProductPublishingInput
): Promise<string> {
  const product = input.product;

  return `
<h2>${product.name}</h2>
<p>Discover ${product.name}, carefully selected by ${input.brandName} for customers in the ${input.targetMarket} market.</p>

<h3>Why you'll love it</h3>
<ul>
  <li>Selected using Aiventra AI product intelligence</li>
  <li>Designed for everyday convenience</li>
  <li>Great value with practical benefits</li>
</ul>

<h3>Product Details</h3>
<ul>
  <li>Category: ${product.category}</li>
  <li>Supplier: ${product.supplier}</li>
</ul>

<p><strong>Order today and experience smarter shopping.</strong></p>
`.trim();
}
