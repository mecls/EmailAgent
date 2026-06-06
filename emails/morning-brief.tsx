import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import { SITE_CONFIG } from '@/lib/site-config'

interface BriefItem {
  group: string
  line: string
}

interface Props {
  items: BriefItem[]
  date: string
}

const GROUP_ORDER = ['Leads', 'Clients', 'Ops', 'To sign']

export function MorningBriefEmail({ items, date }: Props) {
  const groups = GROUP_ORDER.map((group) => ({
    group,
    lines: items.filter((i) => i.group === group).map((i) => i.line),
  })).filter((g) => g.lines.length > 0)

  return (
    <Html>
      <Head />
      <Preview>{`Your morning brief — ${items.length} thing${items.length === 1 ? '' : 's'} that need attention`}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={eyebrow}>MORNING BRIEF · {date}</Text>
          <Text style={h1}>What needs your attention today</Text>

          {groups.length === 0 ? (
            <Text style={p}>
              Nothing pressing in your inbox since the last brief. Enjoy it.
            </Text>
          ) : (
            groups.map((g) => (
              <Section key={g.group} style={{ margin: '0 0 20px' }}>
                <Text style={groupLabel}>{g.group}</Text>
                {g.lines.map((line, idx) => (
                  <Text key={idx} style={item}>
                    • {line}
                  </Text>
                ))}
              </Section>
            ))
          )}

          <Hr style={hr} />
          <Text style={footer}>
            {SITE_CONFIG.brand} · read-only inbox assistant. Reply states are
            computed automatically; nothing was sent on your behalf.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default MorningBriefEmail

const body: React.CSSProperties = {
  backgroundColor: '#08080b',
  color: '#f5f5f7',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  margin: 0,
  padding: '40px 0',
}

const container: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px',
  backgroundColor: '#0d0d11',
  borderRadius: '16px',
  border: '1px solid #1c1c22',
}

const eyebrow: React.CSSProperties = {
  fontSize: '11px',
  letterSpacing: '0.14em',
  color: '#7a7a85',
  margin: '0 0 8px',
}

const h1: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 600,
  lineHeight: 1.25,
  margin: '0 0 24px',
  color: '#f5f5f7',
}

const groupLabel: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#8ea2ff',
  margin: '0 0 6px',
}

const item: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: 1.55,
  color: '#c8c8d0',
  margin: '0 0 6px',
}

const p: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: 1.6,
  color: '#c8c8d0',
  margin: '0 0 16px',
}

const hr: React.CSSProperties = {
  borderColor: '#1c1c22',
  margin: '28px 0 16px',
}

const footer: React.CSSProperties = {
  fontSize: '12px',
  color: '#5a5a62',
  margin: 0,
}
