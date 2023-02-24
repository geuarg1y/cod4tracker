import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfigProvider, Button, Input, notification, Space, Table, Row, Col } from 'antd';
import type { ColumnsType } from "antd/es/table";
import ruLocale from "antd/es/locale/ru_RU";
import { CopyOutlined } from "@ant-design/icons";
import "./App.css";

interface RawServer {
  hn: string; // name
  map: string; // map
  game: string; // mod
  clc: number; // players
  maxcl: number; // max players
  human: number; // real players
  pw: boolean; // ?
  cc: string; // country
  type: string; // game mode
  addr: string; // ip
}

interface NormalizedServer {
  status: string; // статус сервера ('dead' | 'alive')
  name: string; // название
  map: string; // карта
  gameMode: string; // игровой режим (первенство, КБ, НиУ и тд)
  online: number; // всего онлайн
  bots: number; // ботов онлайн
  human: number; // людей онлайн
  capacity: number; // всего мест
  country: string; // страна
  mod: string; // игровой мод
  addresses: string[]; // ip адреса
}

// cors service url - https://github.com/jolav/codetabs/issues/27
// const corsServiceUrl = "https://api.codetabs.com/v1/proxy/?quest=";
const corsServiceUrl = "https://api.codetabs.com/v1/tmp/?quest="; // temp alternative
const dataUrl = "http://cod4master.cod4x.ovh/serverstatus.json";

const gameModLabels: Record<string, string> = {
  dom: "Первенство",
  dm: "Свободная игра",
  war: "Командный бой",
  sd: "Найти и уничтожить",
  sab: "Саботаж",
  koth: "Штаб",
  gg: "GunGame"
};

const countries: Record<string, string> = {
  "--": "Не указано",
  CZ: "Чехия",
  FR: "Франция",
  US: "США",
  DE: "Германия",
  GB: "Англия",
  HU: "Венгрия",
  CA: "Канада",
  UA: "Украина",
  RU: "Россия",
  LT: "ЛИТВА",
  NL: "Нидерланды",
  AU: "Австралия",
  IR: "Иран",
  IQ: "Ирак",
  BR: "Бразилия",
  PL: "Польша",
  IN: "Индия",
  BE: "Бельгия",
  DK: "Дания",
  SE: "Швеция",
  IT: "Италия",
  JP: "Япония",
  ES: "Испания",
  IL: "Исландия",
  MU: "Маврикий",
  SG: "Сингапур",
  RO: "Румыния",
  NO: "Норвегия",
  AT: "Австрия",
  FI: "Финляндия",
  SI: "Словения",
  GD: "Гренада",
  ET: "Эфиопия"
};

const createFilterFromMap = (data: Record<any, any>) => {
  return Object.keys(data).map((value) => ({
    value,
    text: data[value]
  })).sort((a, b) => a.text.localeCompare(b.text));
};

const normalizeServer = (rawServer: RawServer): NormalizedServer => {
  const parseIpColumn = (addresses: string): string[] => {
    return addresses.split(" ").map((ip) => ip.slice(8, -6).replace("]", ""));
  };

  return {
    status: rawServer.addr.split("$")[1],
    // удаляем префиксы вида ^1 (задают цвет текста в названии)
    name: rawServer.hn.replace(new RegExp(/\^\d/, "g"), ""),
    map: rawServer.map,
    gameMode: gameModLabels[rawServer.type] || rawServer.type,
    online: rawServer.clc,
    human: rawServer.human,
    bots: Math.max(rawServer.clc - rawServer.human, 0),
    capacity: rawServer.maxcl,
    country: countries[rawServer.cc],
    mod: rawServer.game,
    addresses: parseIpColumn(rawServer.addr)
  };
};

const copyToClipboard = async (text: string) => {
  return navigator.clipboard.writeText(text);
};

const columns: ColumnsType<NormalizedServer> = [
  {
    title: "Название",
    dataIndex: "name",
    sorter: (a, b) => a.name.localeCompare(b.name)
  },
  {
    title: "Режим",
    dataIndex: "gameMode",
    filters: createFilterFromMap(gameModLabels),
    onFilter: (value, record) =>
      record.gameMode.toLowerCase().indexOf((value as string).toLowerCase()) === 0,
    sorter: (a, b) => a.gameMode.localeCompare(b.gameMode)
  },
  {
    title: "Онлайн",
    dataIndex: "online",
    filters: [
      { value: "noEmpty", text: "Без пустых" },
      { value: "noFull", text: "Без полных" },
      { value: "noBoth", text: "Без пустых и полных" }
    ],
    defaultFilteredValue: ["noBoth"],
    onFilter: (value, record) => {
      if ((value as string) === "noBoth") {
        return record.online > 0 && record.online < record.capacity;
      }

      if ((value as string) === "noEmpty") {
        return record.online > 0;
      }

      if ((value as string) === "noFull") {
        return record.online < record.capacity;
      }

      return false;
    },
    sorter: (a, b) => a.online - b.online
  },
  {
    title: "Боты",
    dataIndex: "bots",
    filters: [{ value: "noBots", text: "Без ботов" }],
    defaultFilteredValue: ["noBots"],
    onFilter: (value, record) => record.bots > 0,
    sorter: (a, b) => a.bots - b.bots
  },
  {
    title: "Люди",
    dataIndex: "human",
    filters: [{ value: 0, text: "Без пустых" }],
    onFilter: (value, record) => record.human > value,
    sorter: (a, b) => a.human - b.human
  },
  {
    title: "Макс",
    dataIndex: "capacity",
    sorter: (a, b) => a.capacity - b.capacity
  },
  {
    title: "IP Адреса",
    dataIndex: "addresses",
    render: (value: string[]) => (
      <>
        {value.map((ip) => (
          <Button
            type="link"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => {
              copyToClipboard(ip).then(() => alert("success"));
            }}
            title="Скопировать"
          >
            {ip}
          </Button>
        ))}
      </>
    )
  },
  {
    title: "Мод",
    dataIndex: "mod",
    filters: [{ value: "main", text: "Без модов" }],
    onFilter: (value, record) => record.mod.indexOf((value as string)) === 0,
    sorter: (a, b) => a.gameMode.localeCompare(b.gameMode)
  },
  {
    title: "Страна",
    dataIndex: "country",
    filters: createFilterFromMap(countries),
    onFilter: (value, record) =>
      record.country.toLowerCase().indexOf((value as string).toLowerCase()) === 0,
    sorter: (a, b) => a.country.localeCompare(b.country)
  }
];

const App: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [servers, setServers] = useState<NormalizedServer[]>([]);

  const displayedServers = useMemo(() => {
      return servers.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [servers, searchQuery]);

  const fetchData = useCallback(() => {
    console.log("fetch data");
    setLoading(true);

    fetch(`${corsServiceUrl}${dataUrl}`)
      .then((res) => res.json())
      .then((res) => {
        console.log(res.servers);

        setServers(
          res.servers
            .map(normalizeServer)
            .filter((s: NormalizedServer) => !s.addresses || s.status !== "dead")
        );
      })
      .catch((e) => {
        console.error(e);

        notification.error({
          message: "Ошибка при получении данных",
          description: e.message
        });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <ConfigProvider locale={ruLocale}>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Row justify="space-between">
          <Col>
              <Input.Search
                placeholder="Поиск по названию"
                onChange={(e) => setSearchQuery(e.target.value)}
                onSearch={setSearchQuery}
                enterButton
              />
          </Col>
          <Col>
            <Button onClick={fetchData} loading={loading}>Обновить</Button>
          </Col>
        </Row>

        <Table
          rowKey="name"
          columns={columns}
          dataSource={displayedServers}
          loading={loading}
        />
      </Space>
    </ConfigProvider>
  );
};

export default App;
