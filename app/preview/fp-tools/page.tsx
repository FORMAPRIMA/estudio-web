import { getContent } from '@/app/actions/web-content'
import { getFpToolsPublic } from '@/app/actions/web-fp-tools'
import { FpToolsPage } from '@/components/public/site/fp-tools/FpToolsPage'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const [content, tools] = await Promise.all([getContent('fp_tools'), getFpToolsPublic()])
  return <FpToolsPage content={content} tools={tools} />
}
