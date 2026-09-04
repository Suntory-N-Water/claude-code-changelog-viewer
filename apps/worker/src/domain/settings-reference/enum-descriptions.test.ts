import { describe, expect, it } from 'vitest';
import {
  buildEnumDescriptionsJa,
  parseEnumDescriptions,
} from './enum-descriptions';

describe('選択肢ごとの日本語説明の組み立て', () => {
  it('英文のある値だけを、英文と同じ並びで JSON にすること', () => {
    expect(
      buildEnumDescriptionsJa(
        {
          latest: 'updates follow the most recent release',
          stable: 'updates follow a week-old version',
        },
        [
          { value: 'stable', descriptionJa: 'おおむね1週間前のリリース' },
          { value: 'latest', descriptionJa: '最新のリリース' },
        ],
      ),
    ).toBe('{"latest":"最新のリリース","stable":"おおむね1週間前のリリース"}');
  });

  it('英文にない値を AI が返したとき、その値を捨てること', () => {
    expect(
      buildEnumDescriptionsJa({ latest: 'the most recent release' }, [
        { value: 'latest', descriptionJa: '最新のリリース' },
        { value: 'nightly', descriptionJa: '毎晩のビルド' },
      ]),
    ).toBe('{"latest":"最新のリリース"}');
  });

  it('AI が返さなかった値を、説明のないままにすること', () => {
    expect(
      buildEnumDescriptionsJa(
        { latest: 'the most recent release', stable: 'a week-old version' },
        [{ value: 'stable', descriptionJa: 'おおむね1週間前のリリース' }],
      ),
    ).toBe('{"stable":"おおむね1週間前のリリース"}');
  });

  it('AI が引用符込みの値を返したとき、引用符を外して照合すること', () => {
    expect(
      buildEnumDescriptionsJa(
        {
          latest: 'the most recent release',
          stable: 'a week-old version',
        },
        [
          { value: '"latest"', descriptionJa: '最新のリリース' },
          { value: '`stable`', descriptionJa: 'おおむね1週間前のリリース' },
        ],
      ),
    ).toBe('{"latest":"最新のリリース","stable":"おおむね1週間前のリリース"}');
  });

  it('日本語が空文字のとき、その値を捨てること', () => {
    expect(
      buildEnumDescriptionsJa({ latest: 'the most recent release' }, [
        { value: 'latest', descriptionJa: '  ' },
      ]),
    ).toBeNull();
  });

  it('英文がないとき、AI の出力を使わないこと', () => {
    expect(
      buildEnumDescriptionsJa(undefined, [
        { value: 'latest', descriptionJa: '最新のリリース' },
      ]),
    ).toBeNull();
  });
});

describe('選択肢ごとの説明の読み取り', () => {
  it('保存された JSON を値と説明の対応にすること', () => {
    expect(parseEnumDescriptions('{"latest":"最新のリリース"}')).toEqual({
      latest: '最新のリリース',
    });
  });

  it.each([
    ['未保存', null],
    ['JSON として読めない値', '{'],
    ['オブジェクトではない値', '["latest"]'],
    ['空のオブジェクト', '{}'],
  ])('%s のとき、説明を持たないことを返すこと', (_label, stored) => {
    expect(parseEnumDescriptions(stored)).toBeUndefined();
  });
});
