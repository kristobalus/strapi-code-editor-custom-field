import React, { Suspense, useState, useEffect, useRef } from 'react'
import { useIntl } from 'react-intl'
import { debounceTime, Subject } from 'rxjs'
import styled from 'styled-components'
import MonacoEditor, { Monaco, useMonaco } from '@monaco-editor/react'

import { Field, FieldHint, FieldError, FieldLabel } from '@strapi/design-system/Field'
import { Stack, Flex, Loader, Select, Option, IconButton, Icon } from '@strapi/design-system'
import { Expand } from '@strapi/icons'
import { MessageFormatElement } from '@formatjs/icu-messageformat-parser'

import initWorkers from '../../utils/workers'

const languages = [
  'css',
  'dockerfile',
  'graphql',
  'html',
  'javascript',
  'json',
  'kotlin',
  'markdown',
  'mysql',
  'php',
  'plaintext',
  'powerquery',
  'powershell',
  'python',
  'scss',
  'shell',
  'sql',
  'typescript',
  'xml',
  'yaml',
]

const FullScreenDiv = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 999;
  padding: 45px;
  background: ${({ theme }) => theme.colors.neutral100};
`

const NormalDiv = styled.div`
  min-height: 35vh;
`

interface MessageDescriptor {
  id?: string
  description?: string | object
  defaultMessage?: string | MessageFormatElement[]
}

type CodeEditorPropsT = {
  attribute: {
    customField: string
    options?: {
      language?: string
      defaultValue?: string
    }
  }
  description: MessageDescriptor
  error?: string
  intlLabel: MessageDescriptor
  labelAction?: React.ReactNode
  name: string
  onChange: (ev: { target: { name: string; value: string } }) => void
  required: boolean
  value: null | string
}

initWorkers()

const CodeEditor = ({
  attribute,
  description,
  // disabled, - todo readonly
  error,
  intlLabel,
  labelAction,
  name,
  onChange,
  required,
  value,
}: CodeEditorPropsT) => {

  const [ options ] = useState({
    formatOnPaste: true,
    formatOnType: true,
    wordWrap: "off"
  } as any)

  const editorRef = useRef<any>(null);
  const monacoRef = useRef(null);
  const { formatMessage } = useIntl()
  const languageRegExp = new RegExp('__(.+)__;')
  const isJson = attribute.customField.endsWith('code-editor-json')
  const languageFromOptions = attribute?.options?.language
  const defaultLanguage = isJson ? 'json' : 'javascript'
  let languageFromValue: null | Array<string> | string = value ? value.match(languageRegExp) : null
  if (languageFromValue && languageFromValue.length > 1) {
    languageFromValue = languageFromValue[1] as string
  } else {
    languageFromValue = null
  }
  const defaultValue = attribute?.options?.defaultValue || undefined
  let defaultValueForEditor = value ? value.replace(languageRegExp, '') : ''
  if (
    (!defaultValueForEditor && defaultValue) ||
    (isJson && typeof value === 'object' && value && Object.keys(value).length === 0 && defaultValue)
  ) {
    defaultValueForEditor = defaultValue
  }
  const [language, setLanguage] = useState(languageFromOptions || languageFromValue || defaultLanguage)
  const [editorValue, setEditorValue] = useState<string>(defaultValueForEditor)
  const [subject] = useState(new Subject<string>())
  const [fullScreen, setFullScreen] = useState(false)
  const [prevValue, setPrevValue] = useState(value)

  if (prevValue !== value) {
    setPrevValue(value)
    setEditorValue(value ? value.replace(languageRegExp, '') : '')
  }

  // @ts-ignore
  const theme = localStorage.getItem('STRAPI_THEME')

  const handleOnChange = (value: string) => {
    onChange({ target: { name, value } })
    setPrevValue(value)
  }

  const monaco = useMonaco();

  useEffect(() => {
    // do conditional chaining
    monaco?.languages.typescript.javascriptDefaults.setEagerModelSync(true);
    // or make sure that it exists by other ways
    if (monaco) {
      console.log('here is the monaco instance:', monaco);
    }
  }, [monaco]);

  useEffect(() => {
    const subscription = subject.pipe(debounceTime(1000)).subscribe(handleOnChange)
    if (defaultValueForEditor) {
      handleChange(defaultValueForEditor)
    }

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleChange = (value?: string) => {
    const valueToSet = value || ''
    setEditorValue(valueToSet)
    subject.next(isJson || languageFromOptions ? valueToSet : `__${language}__;${valueToSet}`)
  }

  const StyledDiv = fullScreen ? FullScreenDiv : NormalDiv

  function handleEditorWillMount(monaco: Monaco) {
    // here is the monaco instance
    // do something before editor is mounted
    // monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);
    // extra libraries
    const libSource = [
      "declare class Facts {",
      "    /**",
      "     * Returns the next fact",
      "     */",
      "    static next():string",
      "}",
    ].join("\n");
    const libUri = "ts:filename/facts.d.ts";
    monaco.languages.typescript.typescriptDefaults.addExtraLib(libSource, libUri);
  }

  function handleEditorDidMount(editor: any, monaco: any) {
    editorRef.current = editor;
    monacoRef.current = monaco;
    console.log('here is the editorRef instance:', editor);
    console.log('here is the monacoRef instance:', monaco);
  }

  return (
    <Field name={name} id={name} error={error} hint={description && formatMessage(description)} required={required}>
      <StyledDiv>
        <Stack spacing={3}>
          <Flex>
            <Flex width="30%" justifyContent="flex-start">
              <FieldLabel action={labelAction}>{formatMessage(intlLabel)}</FieldLabel>
            </Flex>
            <Flex width="70%" justifyContent="flex-end">
              <Stack spacing={2} horizontal>
                <IconButton
                  onClick={() => setFullScreen((prev) => !prev)}
                  label="expand"
                  icon={<Icon width={'10rem'} height={`10rem`} as={Expand} />}
                />
                {!isJson && !languageFromOptions && (
                  <Select id={`${name}-language-select`} label="" value={language} onChange={setLanguage}>
                    {languages.map((lang) => (
                      <Option key={lang} value={lang}>
                        {lang}
                      </Option>
                    ))}
                  </Select>
                )}
              </Stack>
            </Flex>
          </Flex>
          <Suspense fallback={<Loader>Loading</Loader>}>
            <MonacoEditor
              defaultValue={defaultValue}
              height={fullScreen ? '80vh' : '30vh'}
              language={language}
              options={options}
              loading={<Loader>Loading</Loader>}
              onChange={handleChange}
              beforeMount={handleEditorWillMount}
              onMount={handleEditorDidMount}
              theme={theme === 'dark' ? 'vs-dark' : 'light'}
              value={editorValue}
            />
          </Suspense>
          <FieldHint />
          <FieldError />
        </Stack>
      </StyledDiv>
    </Field>
  )
}

export default CodeEditor
