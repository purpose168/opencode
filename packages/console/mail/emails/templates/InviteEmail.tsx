// @ts-nocheck
import React from "react"
import { Img, Row, Html, Link, Body, Head, Button, Column, Preview, Section, Container } from "@jsx-email/all"
import { Text, Fonts, Title, A, Span } from "../components"
import {
  unit,
  body,
  frame,
  headingText,
  container,
  contentText,
  button,
  contentHighlightText,
  linkText,
  buttonText,
} from "../styles"

const CONSOLE_URL = "https://opencode.ai/"

/**
 * 邀请邮件属性接口
 */
interface InviteEmailProps {
  /** 邀请人邮箱 */
  inviter: string
  /** 工作区 ID */
  workspaceID: string
  /** 工作区名称 */
  workspaceName: string
  /** 资源文件 URL */
  assetsUrl: string
}

/**
 * 邀请邮件组件
 * 用于生成邀请用户加入 OpenCode 工作区的邮件
 */
export const InviteEmail = ({
  inviter = "test@anoma.ly",
  workspaceID = "wrk_01K6XFY7V53T8XN0A7X8G9BTN3",
  workspaceName = "anomaly",
  assetsUrl = `${CONSOLE_URL}email`,
}: InviteEmailProps) => {
  const messagePlain = `${inviter} 邀请您加入 ${workspaceName} 工作区。`
  const url = `${CONSOLE_URL}workspace/${workspaceID}`
  return (
    <Html lang="zh-CN">
      <Head>
        <Title>{`OpenCode — ${messagePlain}`}</Title>
      </Head>
      <Fonts assetsUrl={assetsUrl} />
      <Preview>{messagePlain}</Preview>
      <Body style={body} id={Math.random().toString()}>
        <Container style={container}>
          <Section style={frame}>
            <Row>
              <Column>
                <A href={`${CONSOLE_URL}zen`}>
                  <Img height="32" alt="OpenCode 标志" src={`${assetsUrl}/logo.png`} />
                </A>
              </Column>
            </Row>

            <Section style={{ padding: `${unit * 2}px 0 0 0` }}>
              <Text style={headingText}>加入团队的 OpenCode 工作区</Text>
              <Text style={contentText}>
                您已被 <Span style={contentHighlightText}>{inviter}</Span> 邀请加入 OpenCode 上的{
                  " "
                }
                <Span style={contentHighlightText}>{workspaceName}</Span> 工作区。
              </Text>
            </Section>

            <Section style={{ padding: `${unit}px 0 0 0` }}>
              <Button style={button} href={url}>
                <Text style={buttonText}>
                  加入工作区
                  <Img width="24" height="24" src={`${assetsUrl}/right-arrow.png`} alt="右箭头" />
                </Text>
              </Button>
            </Section>

            <Section style={{ padding: `${unit}px 0 0 0` }}>
              <Text style={contentText}>按钮不工作？请复制以下链接...</Text>
              <Link href={url}>
                <Text style={linkText}>{url}</Text>
              </Link>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default InviteEmail
