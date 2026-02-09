/**
 * Query Results Screen
 * Displays query results with natural language responses and data visualizations
 * Provides export functionality for query results
 * Requirements: 7.3
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { QueryResult, QueryIntentType } from '../../modules/query/types';

type QueryStackParamList = {
  QueryInput: undefined;
  QueryResults: {
    queryResult: QueryResult;
  };
};

type QueryResultsScreenRouteProp = RouteProp<QueryStackParamList, 'QueryResults'>;
type QueryResultsScreenNavigationProp = StackNavigationProp<QueryStackParamList, 'QueryResults'>;

type ExportFormat = 'csv' | 'json' | 'text';

interface VisualizationData {
  type: 'bar' | 'line' | 'pie' | 'table';
  title: string;
  data: any;
}

export const QueryResultsScreen: React.FC = () => {
  const navigation = useNavigation<QueryResultsScreenNavigationProp>();
  const route = useRoute<QueryResultsScreenRouteProp>();
  const { queryResult: initialResult } = route.params;

  const [queryResult, setQueryResult] = useState<QueryResult>(initialResult);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [visualizations, setVisualizations] = useState<VisualizationData[]>([]);

  useEffect(() => {
    processQueryResult();
  }, []);

  const processQueryResult = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement actual query processing with Nova AI
      // For now, creating mock results based on intent type
      const mockResult = await generateMockResult(queryResult);
      setQueryResult(mockResult);
      
      // Generate visualizations if data is available
      if (mockResult.data) {
        const viz = generateVisualizations(mockResult);
        setVisualizations(viz);
      }
    } catch (error) {
      console.error('Error processing query result:', error);
      Alert.alert('Error', 'Failed to process query results');
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockResult = async (result: QueryResult): Promise<QueryResult> => {
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const intentType = result.interpretedIntent.intentType;

    // Generate mock response based on intent type
    let response = '';
    let data: any = null;

    switch (intentType) {
      case 'count':
        response = 'There are 23 participants currently on MAT (Medication-Assisted Treatment).';
        data = {
          count: 23,
          total: 45,
          percentage: 51,
        };
        break;
      case 'list':
        response = 'Here are the participants who have been in recovery for more than 6 months:';
        data = {
          participants: [
            { id: '1', name: 'John Doe', recoveryMonths: 8, status: 'Active' },
            { id: '2', name: 'Jane Smith', recoveryMonths: 12, status: 'Active' },
            { id: '3', name: 'Bob Johnson', recoveryMonths: 7, status: 'Active' },
          ],
        };
        break;
      case 'detail':
        response = "Here's the detailed information for the participant:";
        data = {
          participant: {
            name: 'John Doe',
            status: 'Active',
            recoveryDate: '2023-06-15',
            lastAssessment: '2024-01-15',
            barc10Score: 48,
          },
        };
        break;
      case 'comparison':
        response = 'Comparing BARC-10 scores over time:';
        data = {
          baseline: 32,
          current: 48,
          change: 16,
          percentChange: 50,
          trend: 'improving',
        };
        break;
      case 'trend':
        response = 'Here are the trends for the past 6 months:';
        data = {
          months: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
          values: [15, 18, 22, 20, 23, 25],
        };
        break;
      default:
        response = 'Query processed successfully.';
    }

    return {
      ...result,
      response,
      data,
      processingTimeMs: 1234,
    };
  };

  const generateVisualizations = (result: QueryResult): VisualizationData[] => {
    const viz: VisualizationData[] = [];
    const { data, interpretedIntent } = result;

    if (!data) return viz;

    switch (interpretedIntent.intentType) {
      case 'count':
        viz.push({
          type: 'pie',
          title: 'MAT Participation',
          data: {
            labels: ['On MAT', 'Not on MAT'],
            values: [data.count, data.total - data.count],
          },
        });
        break;

      case 'list':
        viz.push({
          type: 'table',
          title: 'Participants',
          data: data.participants,
        });
        break;

      case 'comparison':
        viz.push({
          type: 'bar',
          title: 'BARC-10 Score Comparison',
          data: {
            labels: ['Baseline', 'Current'],
            values: [data.baseline, data.current],
          },
        });
        break;

      case 'trend':
        viz.push({
          type: 'line',
          title: 'Trend Over Time',
          data: {
            labels: data.months,
            values: data.values,
          },
        });
        break;
    }

    return viz;
  };

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true);
    try {
      let exportContent = '';

      switch (format) {
        case 'text':
          exportContent = formatAsText();
          break;
        case 'csv':
          exportContent = formatAsCSV();
          break;
        case 'json':
          exportContent = formatAsJSON();
          break;
      }

      // Share the content
      await Share.share({
        message: exportContent,
        title: `Query Results - ${queryResult.originalQuery}`,
      });
    } catch (error) {
      console.error('Error exporting results:', error);
      Alert.alert('Error', 'Failed to export results');
    } finally {
      setIsExporting(false);
    }
  };

  const formatAsText = (): string => {
    let text = `Query: ${queryResult.originalQuery}\n\n`;
    text += `Response: ${queryResult.response}\n\n`;
    text += `Timestamp: ${queryResult.timestamp.toLocaleString()}\n`;
    text += `Processing Time: ${queryResult.processingTimeMs}ms\n`;

    if (queryResult.data) {
      text += `\nData:\n${JSON.stringify(queryResult.data, null, 2)}`;
    }

    return text;
  };

  const formatAsCSV = (): string => {
    if (!queryResult.data) {
      return formatAsText();
    }

    // Handle list data
    if (queryResult.data.participants) {
      const participants = queryResult.data.participants;
      let csv = 'ID,Name,Recovery Months,Status\n';
      participants.forEach((p: any) => {
        csv += `${p.id},${p.name},${p.recoveryMonths},${p.status}\n`;
      });
      return csv;
    }

    // Handle other data types
    return formatAsText();
  };

  const formatAsJSON = (): string => {
    return JSON.stringify(queryResult, null, 2);
  };

  const handleNewQuery = () => {
    navigation.goBack();
  };

  const renderVisualization = (viz: VisualizationData, index: number) => {
    switch (viz.type) {
      case 'table':
        return renderTable(viz, index);
      case 'bar':
        return renderBarChart(viz, index);
      case 'line':
        return renderLineChart(viz, index);
      case 'pie':
        return renderPieChart(viz, index);
      default:
        return null;
    }
  };

  const renderTable = (viz: VisualizationData, index: number) => {
    const data = viz.data;
    if (!Array.isArray(data) || data.length === 0) return null;

    const columns = Object.keys(data[0]);

    return (
      <View key={index} style={styles.visualizationCard}>
        <Text style={styles.visualizationTitle}>{viz.title}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.table}>
            {/* Header */}
            <View style={styles.tableRow}>
              {columns.map((col) => (
                <View key={col} style={styles.tableHeaderCell}>
                  <Text style={styles.tableHeaderText}>{col.toUpperCase()}</Text>
                </View>
              ))}
            </View>
            {/* Rows */}
            {data.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.tableRow}>
                {columns.map((col) => (
                  <View key={col} style={styles.tableCell}>
                    <Text style={styles.tableCellText}>{row[col]}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderBarChart = (viz: VisualizationData, index: number) => {
    const { labels, values } = viz.data;
    const maxValue = Math.max(...values);
    const screenWidth = Dimensions.get('window').width - 64;

    return (
      <View key={index} style={styles.visualizationCard}>
        <Text style={styles.visualizationTitle}>{viz.title}</Text>
        <View style={styles.chartContainer}>
          {labels.map((label: string, i: number) => {
            const barHeight = (values[i] / maxValue) * 150;
            return (
              <View key={i} style={styles.barContainer}>
                <View style={styles.barWrapper}>
                  <View style={[styles.bar, { height: barHeight }]}>
                    <Text style={styles.barValue}>{values[i]}</Text>
                  </View>
                </View>
                <Text style={styles.barLabel}>{label}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderLineChart = (viz: VisualizationData, index: number) => {
    const { labels, values } = viz.data;

    return (
      <View key={index} style={styles.visualizationCard}>
        <Text style={styles.visualizationTitle}>{viz.title}</Text>
        <View style={styles.lineChartContainer}>
          <Text style={styles.chartPlaceholder}>
            📈 Line chart visualization
          </Text>
          <View style={styles.dataPointsContainer}>
            {labels.map((label: string, i: number) => (
              <View key={i} style={styles.dataPoint}>
                <Text style={styles.dataPointLabel}>{label}</Text>
                <Text style={styles.dataPointValue}>{values[i]}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderPieChart = (viz: VisualizationData, index: number) => {
    const { labels, values } = viz.data;
    const total = values.reduce((sum: number, val: number) => sum + val, 0);

    return (
      <View key={index} style={styles.visualizationCard}>
        <Text style={styles.visualizationTitle}>{viz.title}</Text>
        <View style={styles.pieChartContainer}>
          <Text style={styles.chartPlaceholder}>🥧 Pie chart visualization</Text>
          <View style={styles.legendContainer}>
            {labels.map((label: string, i: number) => {
              const percentage = ((values[i] / total) * 100).toFixed(1);
              return (
                <View key={i} style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: i === 0 ? '#007AFF' : '#E0E0E0' }]} />
                  <Text style={styles.legendText}>
                    {label}: {values[i]} ({percentage}%)
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Processing query...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Query Results</Text>
        <Text style={styles.query}>{queryResult.originalQuery}</Text>
        <View style={styles.metaContainer}>
          <Text style={styles.metaText}>
            Processed in {queryResult.processingTimeMs}ms
          </Text>
          <Text style={styles.metaText}>
            {queryResult.timestamp.toLocaleTimeString()}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Response */}
        <View style={styles.responseCard}>
          <Text style={styles.responseLabel}>Response</Text>
          <Text style={styles.responseText}>{queryResult.response}</Text>
        </View>

        {/* Visualizations */}
        {visualizations.length > 0 && (
          <View style={styles.visualizationsContainer}>
            {visualizations.map((viz, index) => renderVisualization(viz, index))}
          </View>
        )}

        {/* Export Options */}
        <View style={styles.exportCard}>
          <Text style={styles.exportTitle}>Export Results</Text>
          <View style={styles.exportButtons}>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={() => handleExport('text')}
              disabled={isExporting}
            >
              <Text style={styles.exportButtonText}>📄 Text</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={() => handleExport('csv')}
              disabled={isExporting}
            >
              <Text style={styles.exportButtonText}>📊 CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={() => handleExport('json')}
              disabled={isExporting}
            >
              <Text style={styles.exportButtonText}>🔧 JSON</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* New Query Button */}
        <TouchableOpacity style={styles.newQueryButton} onPress={handleNewQuery}>
          <Text style={styles.newQueryButtonText}>Ask Another Question</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  query: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  metaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    fontSize: 12,
    color: '#999',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  responseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  responseLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  responseText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  visualizationsContainer: {
    gap: 16,
    marginBottom: 16,
  },
  visualizationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  visualizationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  table: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tableHeaderCell: {
    padding: 12,
    backgroundColor: '#F8F9FA',
    minWidth: 100,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  tableCell: {
    padding: 12,
    minWidth: 100,
  },
  tableCellText: {
    fontSize: 14,
    color: '#333',
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 200,
    paddingTop: 20,
  },
  barContainer: {
    alignItems: 'center',
    flex: 1,
  },
  barWrapper: {
    height: 150,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: 40,
    backgroundColor: '#007AFF',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 4,
  },
  barValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  barLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  lineChartContainer: {
    alignItems: 'center',
  },
  chartPlaceholder: {
    fontSize: 32,
    marginBottom: 16,
  },
  dataPointsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  dataPoint: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    minWidth: 60,
  },
  dataPointLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  dataPointValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  pieChartContainer: {
    alignItems: 'center',
  },
  legendContainer: {
    marginTop: 16,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
    color: '#333',
  },
  exportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  exportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  exportButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  exportButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  exportButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  newQueryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  newQueryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
