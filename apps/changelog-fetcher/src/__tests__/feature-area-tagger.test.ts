import { describe, expect, test } from 'bun:test';
import { tagFeatureAreas } from '../parsers/feature-area-tagger';

describe('tagFeatureAreas', () => {
  describe('個別ルールのマッチ', () => {
    test.each([
      ['VSCode extension updated', ['IDE/VSCode']],
      ['Added hooks support', ['Hooks']],
      ['New hook for pre-commit', ['Hooks']],
      ['MCP server integration', ['MCP']],
      ['Model Context Protocol support', ['MCP']],
      ['Added new skill', ['Skills']],
      ['Custom skills management', ['Skills']],
      ['agent team collaboration', ['Agent Teams']],
      ['agent teams feature', ['Agent Teams']],
      ['teammate integration', ['Agent Teams']],
      ['sub-agent spawning', ['Sub-agents']],
      ['subagent management', ['Sub-agents']],
      ['plan mode improvements', ['Plan']],
      ['plugin marketplace', ['Plugins']],
      ['plugins directory', ['Plugins']],
      ['settings page update', ['Settings']],
      ['memory management', ['Memory']],
      ['CLAUDE.md configuration', ['Memory']],
      ['permission system', ['Permissions']],
      ['file permissions check', ['Permissions']],
    ])('"%s" → %j', (content, expectedTags) => {
      expect(tagFeatureAreas(content)).toEqual(expectedTags);
    });
  });

  describe('複数タグのマッチ', () => {
    test('複数のルールにマッチする場合、全タグを返す', () => {
      const tags = tagFeatureAreas('VSCode hooks integration for MCP settings');
      expect(tags).toContain('IDE/VSCode');
      expect(tags).toContain('Hooks');
      expect(tags).toContain('MCP');
      expect(tags).toContain('Settings');
    });
  });

  describe('マッチなし', () => {
    test('どのルールにもマッチしない場合は空配列を返す', () => {
      expect(tagFeatureAreas('Fixed a bug in error handling')).toEqual([]);
    });

    test('空文字列は空配列を返す', () => {
      expect(tagFeatureAreas('')).toEqual([]);
    });
  });

  describe('大文字小文字の扱い', () => {
    test('VSCode は大文字小文字を問わずマッチする', () => {
      expect(tagFeatureAreas('vscode extension')).toEqual(['IDE/VSCode']);
    });

    test('MCP はリテラル "MCP" のみマッチする', () => {
      // MCP のパターンは /\bMCP\b|Model Context Protocol/
      // \bMCP\b は i フラグなしの部分と Model Context Protocol で分かれる
      expect(tagFeatureAreas('MCP support')).toEqual(['MCP']);
    });

    test('hooks は大文字小文字を問わずマッチする', () => {
      expect(tagFeatureAreas('HOOKS configuration')).toEqual(['Hooks']);
    });
  });
});
